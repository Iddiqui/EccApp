import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, Text, TouchableOpacity } from 'react-native';
import { LiveKitRoom, AudioSession, useConnectionState } from '@livekit/react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { ClassRoomView, FloatingCallBubble, ClassRoomController } from './ClassRoomScreen';
import { VideoSessionView } from '../../sessions/VideoSessionScreen';
import { StudyRoomView, StudyRoomController, RoomPresenceReporter } from './StudyRoomScreen';
import { RoomVolumeControl } from './RoomVolumeControl';
import { startCallForegroundService, stopCallForegroundService } from './callForegroundService';

// ─── DEBUG ERROR BOUNDARY ───
// 🐛 WHITE-SCREEN DEBUGGER: Class Room leave karne ke baad kabhi-kabhi
// puri screen (navigator + bottom tabs sab) blank white ho ja rahi thi,
// aur sirf Metro reload se theek hoti thi — jo classic signature hai ek
// UNCAUGHT render-time crash ka jisko React silently blank tree bana
// deta hai (koi error boundary na hone ki wajah se).
//
// Ye boundary poore `children` (yaani NavigationContainer/navigator) ko
// wrap karta hai. Agar call khatam hone ke baad wapas navigator render
// karte waqt kahin bhi crash hota hai, to ab blank white screen ki jagah
// ACTUAL error message + ek "Reload" button dikhega — jisse (a) user
// turant recover kar sakta hai bina Metro/app restart ke, aur (b) hume
// asli root-cause pata chal jaayega (error text screenshot karke bhej
// sakte ho).
class CallSessionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('CallSessionProvider ErrorBoundary caught a crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={debugErrorStyles.container}>
          <Text style={debugErrorStyles.title}>something error</Text>
          <Text style={debugErrorStyles.message} selectable>
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </Text>
          <TouchableOpacity
            style={debugErrorStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={debugErrorStyles.buttonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const debugErrorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

// Starts the background (foreground-service) notification only AFTER the room is connected,
// so it can never disturb the connection or the audio setup.
const CallServiceStarter = ({ title }: { title?: string }) => {
  const cs = useConnectionState();
  const connected = String(cs).toLowerCase() === 'connected';
  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(() => {
      try { startCallForegroundService(title); } catch (e) {}
    }, 2500);
    return () => clearTimeout(t);
  }, [connected, title]);
  return null;
};

// ─── TYPES ───
type RoomType = 'class' | 'one_to_one' | 'study';

interface CallParams {
  serverUrl: string;
  token: string;
  roomType?: RoomType; // default 'class' — StudyRoom bhi filhaal 'class' jaisa treat hota hai
  roomTitle?: string;
  isHost?: boolean;
  roomId?: string;
  userAvatarUrl?: string;
  // 1-to-1 specific
  otherPersonName?: string;
  otherPersonAvatarUrl?: string;
  bookingId?: string;
}

interface CallSessionContextType {
  activeCall: CallParams | null;
  isMinimized: boolean;
  startCall: (params: CallParams) => void;
  minimizeCall: () => void;
  expandCall: () => void;
  endCall: () => void;
  // 🖤 NATIVE-SURFACE RESIDUE WORKAROUND: LiveKit's React Native SDK
  // (@livekit/react-native / @livekit/react-native-webrtc) officially
  // does NOT yet support React Native's New Architecture (Fabric) —
  // confirmed via LiveKit's own open GitHub issue #134 and Expo/React
  // Native Directory's compatibility listing. On apps forced onto the
  // New Architecture (mandatory since RN 0.82+), the native camera/video
  // SurfaceView used internally sits OUTSIDE Fabric's synchronous
  // rendering/compositing model, so it can leave a leftover rendered
  // frame ("ghost" white overlay) behind after the call UI unmounts or
  // collapses — with no JS exception, since it happens at a layer Fabric
  // and React don't fully control yet.
  //
  // This can't be fixed purely by resizing/hiding React views (already
  // tried: transparency, 0x0 clipping, delays — none work reliably,
  // since Fabric simply isn't managing that native layer). The only
  // reliable JS-side workaround is forcing a genuine UNMOUNT + REMOUNT
  // of the screen behind the call, which recreates its native view tree
  // from scratch and clears any residue. `remountSignal` increments
  // every time the call state changes (minimize or end) — screens can
  // use it as a React `key` on their root element to force this remount.
  remountSignal: number;
}

const CallSessionContext = createContext<CallSessionContextType | null>(null);

// Har screen/component isse use karega call ko control karne ke liye
// (ClassRoomScreen isko already use kar raha hai).
export const useCallSession = () => {
  const ctx = useContext(CallSessionContext);
  if (!ctx) {
    throw new Error(
      'useCallSession() ClassroomScreen will only work if the entire app is wrapped in a `CollectionProvider` — see `App.tsx.'
    );
  }
  return ctx;
};

// ─── PROVIDER ───
// Ye component App.tsx me <NavigationContainer> ke SATH SIBLING (ya use
// wrap karke) render hona chahiye — navigator ke ANDAR nahi. Isi wajah se ye
// jo overlay render karta hai wo navigator ke UPAR dikhta hai, screen change
// hone par bhi persist karta hai.
export const CallSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeCall, setActiveCall] = useState<CallParams | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [canConnect, setCanConnect] = useState(false);
  const [remountSignal, setRemountSignal] = useState(0);
  const preparingRef = useRef(false);

  const startCall = useCallback(async (params: CallParams) => {
    if (preparingRef.current) return; // duplicate-call guard
    preparingRef.current = true;

    setActiveCall(params);
    setIsMinimized(false);
    setCanConnect(false);

    try {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
      }

      // Configure first, then start (the settings are read when the session starts)
      if (AudioSession.configureAudio) {
        try {
          await AudioSession.configureAudio({
            android: { preferredOutputList: ['speaker', 'earpiece', 'headset', 'bluetooth'] },
            ios: { defaultOutput: 'speaker' },
          } as any);
        } catch (e) {
          console.log('configureAudio error:', e);
        }
      }
      await AudioSession.startAudioSession();

      setCanConnect(true);
    } catch (err) {
      console.error('CallSessionProvider permission/audio error:', err);
    } finally {
      preparingRef.current = false;
    }
  }, []);

  const minimizeCall = useCallback(() => {
    setIsMinimized(true);
    // Native-surface residue workaround — see remountSignal doc comment above.
    setRemountSignal(s => s + 1);
  }, []);
  const expandCall = useCallback(() => setIsMinimized(false), []);

  const endCall = useCallback(async () => {
    // 🔑 THE ACTUAL FIX: room cleanup used to live ONLY inside
    // ClassRoomView's full-screen "leave call" button handler. But the
    // floating bubble's end-call button calls this `endCall()` directly,
    // bypassing that handler entirely — so if the host ended the call from
    // the minimized bubble, the Firestore `voice_rooms` document never got
    // deleted and stayed listed as "active" forever (until someone else
    // ended it properly). Doing the delete HERE means it always runs, no
    // matter which UI path triggered the end.
    //
    // NOTE: 1-to-1 sessions ('one_to_one' roomType) ke liye ye delete NAHI
    // chalta, kyunki unka koi `voice_rooms` doc hota hi nahi — wo `bookings`
    // collection use karte hain, jo already `verifyPayment`/`cancelBooking`
    // se manage hota hai.
    //
    // 🔒 HOST-ONLY ROOM END (server-verified): sirf client se aaye
    // `isHost` boolean pe bharosa karne ke bajaye, delete karne se PEHLE
    // Firestore se room ka FRESH doc padh kar uska `createdBy` current
    // logged-in user ke uid se match karte hain. Sirf ASLI creator
    // (jisne room banaya tha) ka minimize-bubble se end-call room ko
    // sabke liye khatam karega — baad me join karne wala koi bhi
    // admin/user apna bubble band karega to bas KHUD leave hoga, baaki
    // sabka call chalta rahega.
    const endingCall = activeCall;
    try {
      const rid = endingCall?.roomId;
      const uid = auth().currentUser?.uid;
      if (endingCall?.roomType === 'study' && rid && uid) {
        // PUBLIC ROOM: the host leaving does NOT remove the room while people are still inside.
        // The card stays in the list as "Host Left"; the room is removed when the last person leaves.
        const ref = firestore().collection('voice_rooms').doc(rid);
        const roomSnap = await ref.get();
        if (roomSnap.exists) {
          const roomData: any = roomSnap.data() || {};
          const isCreator = roomData.createdBy === uid;
          const partSnap = await ref.collection('participants').get();
          const now = Date.now();
          const others = partSnap.docs.filter((d) => {
            if (d.id === uid) return false;
            const ls: any = d.data()?.lastSeen;
            const ms = ls && typeof ls.toMillis === 'function' ? ls.toMillis() : null;
            return ms === null || now - ms < 70 * 1000;
          }).length;
          if (others === 0) {
            await ref.delete();
          } else if (isCreator) {
            await ref.update({ hostLeft: true, hostLeftAt: firestore.FieldValue.serverTimestamp() });
          }
        }
      } else if (
        endingCall?.roomType !== 'one_to_one' &&
        endingCall?.isHost &&
        endingCall?.roomId
      ) {
        const roomSnap = await firestore()
          .collection('voice_rooms')
          .doc(endingCall.roomId)
          .get();
        const roomData = roomSnap.data();
        const currentUid = auth().currentUser?.uid;
        const isActualCreator = !!roomData && !!currentUid && roomData.createdBy === currentUid;

        if (isActualCreator) {
          await firestore().collection('voice_rooms').doc(endingCall.roomId).delete();
        }
      }
    } catch (e) {
      console.log('CallSessionProvider: error closing room on end call:', e);
    }

    setCanConnect(false);
    setIsMinimized(false);
    setActiveCall(null);
    // Native-surface residue workaround — see remountSignal doc comment above.
    setRemountSignal(s => s + 1);
    await AudioSession.stopAudioSession().catch(() => {});
    stopCallForegroundService();
  }, [activeCall]);

  return (
    <CallSessionContext.Provider
      value={{ activeCall, isMinimized, startCall, minimizeCall, expandCall, endCall, remountSignal }}
    >
      {/* Poora app navigator neeche render hota hai, jaisa normal.
          ErrorBoundary se wrapped hai taaki call-end ke baad koi bhi
          silent crash blank white screen na bane balki actual error
          message dikhaye. */}
      <CallSessionErrorBoundary>{children}</CallSessionErrorBoundary>

      {/*
        Call overlay — navigator ke UPAR.

        🖤 MINIMIZE WHITE-SCREEN ROOT-FIX: pehle poora <LiveKitRoom> block
        ek View ke andar tha jiska sirf `backgroundColor` minimize hone par
        'transparent' kar diya jaata tha. Problem: Android pe camera/video
        preview ek native SurfaceView hai, jo normal Views se ALAG ek
        hardware-composited layer me draw hota hai — aur wo layer parent
        View ka `backgroundColor`/opacity IGNORE kar deta hai. Isliye
        "transparent" karne par bhi kabhi-kabhi ek leftover camera frame
        poori screen par SOLID WHITE dikhta reh jaata tha (khaaskar jinka
        camera actually ON tha — jaise HOST, jo bina kisi restriction ke
        camera chala sakta hai).

        Fix: ab call-content (`ClassRoomView`/`VideoSessionView`) aur
        `FloatingCallBubble` do ALAG chhote containers me rakhe hain, dono
        hi EK SAME `<LiveKitRoom>` ke andar (context/connection break nahi
        hoti). Jab minimize hota hai:
          1. Call-content wala container width/height 0 aur overflow
             'hidden' ho jaata hai — ye sirf paint-level transparency nahi
             balki LAYOUT-level CLIPPING hai, jo native SurfaceView ko bhi
             properly hide/clip karta hai (jaisa transparent color nahi kar
             paata).
          2. Content khud bhi unmount ho jaata hai (`!isMinimized &&`), to
             uske andar koi video surface bachta hi nahi.
          3. Bubble ek ALAG, normal-size wale container me render hota hai,
             jo collapse nahi hota — isliye wo hamesha sahi dikhta hai.
      */}
      {activeCall && canConnect && (
        <LiveKitRoom
          // Keyed per room so React always mounts a fresh LiveKitRoom
          // instance if `activeCall` ever changes to a different room
          // while the overlay is still up (defensive — mirrors the same
          // fix applied to StudyRoomScreen's LiveKitRoom).
          key={`${activeCall.roomId || activeCall.bookingId || 'call'}-${activeCall.token}`}
          serverUrl={activeCall.serverUrl}
          token={activeCall.token}
          connect={canConnect}
          // 1-to-1 video session ek explicit "video call" hai, isliye
          // camera+mic default ON. Class/Study room me students khud
          // manually camera/mic on karte hain, isliye wahan false hi
          // rehta hai (jaisa pehle tha).
          // Study (public) room: only the host's mic starts ON. Everyone else needs the host's permission.
          audio={activeCall.roomType === 'one_to_one'}
          video={activeCall.roomType === 'one_to_one'}
          options={{
            adaptiveStream: true,
            dynacast: true,
            autoSubscribe: true,
          }}
        >
          <CallServiceStarter title={activeCall.roomTitle || activeCall.otherPersonName} />
          {/* Always-mounted helpers (they keep working while the room is minimized) */}
          {activeCall.roomType === 'study' && <StudyRoomController isHost={!!activeCall.isHost} userAvatarUrl={activeCall.userAvatarUrl} roomId={activeCall.roomId} onRoomClosed={endCall} />}
          {(activeCall.roomType === 'class' || !activeCall.roomType) && <ClassRoomController userAvatarUrl={activeCall.userAvatarUrl} />}
          {activeCall.roomType !== 'one_to_one' && <RoomPresenceReporter roomId={activeCall.roomId} />}

          {/* Full call UI — minimize hote hi genuinely 0x0 + clipped ho
              jaata hai (sirf transparent nahi), taaki koi bhi leftover
              native camera/video surface bhi saath me hide ho jaaye. */}
          <View
            style={
              isMinimized
                ? styles.collapsedCallContainer
                : [StyleSheet.absoluteFill, { backgroundColor: '#070D18' }]
            }
            pointerEvents={isMinimized ? 'none' : 'auto'}
          >
            {!isMinimized &&
              (activeCall.roomType === 'one_to_one' ? (
                <VideoSessionView
                  safeExit={endCall}
                  onMinimize={minimizeCall}
                  otherPersonName={activeCall.otherPersonName}
                  otherPersonAvatarUrl={activeCall.otherPersonAvatarUrl}
                  userAvatarUrl={activeCall.userAvatarUrl}
                />
              ) : activeCall.roomType === 'study' ? (
                <StudyRoomView
                  safeExit={endCall}
                  onMinimize={minimizeCall}
                  roomTitle={activeCall.roomTitle}
                  isHost={activeCall.isHost}
                  roomId={activeCall.roomId}
                  userAvatarUrl={activeCall.userAvatarUrl}
                />
              ) : (
                <ClassRoomView
                  safeExit={endCall}
                  onMinimize={minimizeCall}
                  roomTitle={activeCall.roomTitle}
                  isHost={activeCall.isHost}
                  roomId={activeCall.roomId}
                  userAvatarUrl={activeCall.userAvatarUrl}
                />
              ))}
          </View>

          {/* Volume control (0-300%) for every room type, hidden while minimized */}
          {!isMinimized && <RoomVolumeControl />}

          {/* Bubble — apna ALAG, normal-size container, isliye
              call-content wale container ke collapse se bilkul unaffected
              rehta hai. `pointerEvents="box-none"` isliye taaki bubble ke
              ALAWA baaki jagah ke touches neeche navigator tak pahunchein. */}
          {isMinimized && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <FloatingCallBubble
                roomTitle={activeCall.roomTitle || activeCall.otherPersonName}
                userAvatarUrl={activeCall.userAvatarUrl}
                onExpand={expandCall}
                onEndCall={endCall}
              />
            </View>
          )}
        </LiveKitRoom>
      )}
    </CallSessionContext.Provider>
  );
};

const styles = StyleSheet.create({
  collapsedCallContainer: {
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});