import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  BackHandler,
  Share,
  Alert,
  InteractionManager,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  LiveKitRoom,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
  useConnectionState,
  AudioSession,
  registerGlobals,
} from '@livekit/react-native';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  MessageSquare, 
  Smile, 
  X, 
  Send, 
  Volume2,
  Hand,
  ChevronDown,
  Share2,
} from 'lucide-react-native';
import { RoomEvent } from 'livekit-client';
import { useCallSession } from './CallSessionProvider';

registerGlobals();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUSBAR_SAFE_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 14 : 14;
const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👏', '😂', '💡', '🎉', '👋', '💯', '✨'];
const DEFAULT_FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundColor=ffd5dc';


// ─────────────────────────────────────────────────────────────────────────────
// AVATAR: profile picture / chosen avatar, or the first letter of the name when there is none.
// (Nobody gets a random default cartoon any more.)
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#EF4444', '#14B8A6'];
const avatarColorFor = (name: string = 'U') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const AvatarCircle = ({ uri, name, style, textSize = 22 }: { uri?: string; name?: string; style?: any; textSize?: number }) => {
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  const letter = String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
  return (
    <View style={[style, { backgroundColor: avatarColorFor(name || 'U'), justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: '#FFFFFF', fontSize: textSize, fontWeight: '800' }}>{letter}</Text>
    </View>
  );
};

// The room token cannot update LiveKit metadata, so avatar + host status travel as PROFILE data packets
// and are kept in the shared store. This reads host status from there first, metadata only as a fallback.
const isHostById = (identity?: string): boolean => !!(identity && ctlState.profiles[identity]?.isHost);
const isHostParticipant = (p: any): boolean => {
  if (isHostById(p?.identity)) return true;
  try {
    return !!JSON.parse(p?.metadata || '{}').isHost;
  } catch (e) {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOST CONTROLS (shared state between the always-mounted controller and the room screen)
//
// The controller below stays mounted while the call is running, even when the room screen is minimized,
// so the host still receives speak requests and a speaker's timer keeps running.
// Messages travel as LiveKit data packets:
//   SPEAK_REQUEST  student -> host      "I would like to speak"
//   SPEAK_CANCEL   student -> host      request withdrawn
//   SPEAK_GRANT    host -> student      allowed to speak for `duration` seconds
//   SPEAK_DENY     host -> student      request declined
//   HOST_MUTE      host -> student/ALL  mic switched off
// ─────────────────────────────────────────────────────────────────────────────
const SPEAK_DURATIONS = [180, 300, 600]; // 3, 5 and 10 minutes
const DEFAULT_SPEAK_SECONDS = 600;
const formatSpeakTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const speakLabel = (sec: number) => `${Math.round(sec / 60)} min`;

type SpeakRequest = { senderId: string; senderName: string };
type StudyProfile = { avatarUrl: string; isHost: boolean };
type StudyCtl = {
  profiles: Record<string, StudyProfile>;
  requests: SpeakRequest[];
  timeRemaining: number | null;
  requestPending: boolean;
  approve: (senderId: string, seconds: number) => void;
  deny: (senderId: string) => void;
  requestSpeak: () => void;
  stopMyMic: () => void;
  muteParticipant: (identity: string) => void;
  grantParticipant: (identity: string, seconds: number) => void;
  muteAll: () => void;
};
const noopCtl = () => {};
const CTL_DEFAULT: StudyCtl = {
  profiles: {},
  requests: [],
  timeRemaining: null,
  requestPending: false,
  approve: noopCtl,
  deny: noopCtl,
  requestSpeak: noopCtl,
  stopMyMic: noopCtl,
  muteParticipant: noopCtl,
  grantParticipant: noopCtl,
  muteAll: noopCtl,
};
let ctlState: StudyCtl = CTL_DEFAULT;
const ctlListeners = new Set<() => void>();
const setCtl = (patch: Partial<StudyCtl>) => {
  ctlState = { ...ctlState, ...patch };
  ctlListeners.forEach((l) => l());
};
const useStudyCtl = (): StudyCtl => {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    ctlListeners.add(l);
    return () => {
      ctlListeners.delete(l);
    };
  }, []);
  return ctlState;
};

const ctlEncoder = new TextEncoder();
const ctlDecoder = new TextDecoder();

export const StudyRoomController = ({ isHost, userAvatarUrl, roomId }: { isHost?: boolean; userAvatarUrl?: string; roomId?: string }) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled: micOn } = useLocalParticipant();
  const timerRef = useRef<any>(null);
  const allowedRef = useRef(false); // true only while the host has allowed this user to speak
  const pendingTimeoutRef = useRef<any>(null);
  const requestsRef = useRef<SpeakRequest[]>([]);
  const lpRef = useRef<any>(null);
  lpRef.current = localParticipant;

  const send = async (obj: any, to?: string) => {
    const lp = lpRef.current;
    if (!lp) return;
    try {
      const data = ctlEncoder.encode(JSON.stringify(obj));
      await lp.publishData(data, to ? { reliable: true, destinationIdentities: [to] } : { reliable: true });
    } catch (e) {
      console.log('Study room data packet error:', e);
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const muteMyself = async () => {
    allowedRef.current = false;
    clearTimer();
    setCtl({ timeRemaining: null });
    try {
      await lpRef.current?.setMicrophoneEnabled(false);
    } catch (e) {}
  };

  const startSpeaking = async (seconds: number) => {
    const lp = lpRef.current;
    if (!lp) return;
    // Mark as allowed BEFORE enabling so the auto-mute guard never fights the grant
    allowedRef.current = true;
    let enabled = false;
    for (let i = 0; i < 3 && !enabled; i++) {
      try {
        await lp.setMicrophoneEnabled(true);
        enabled = true;
      } catch (e) {
        console.log('Could not enable the microphone (attempt ' + (i + 1) + '):', e);
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (!enabled) {
      allowedRef.current = false;
      Alert.alert('Microphone error', 'Could not turn on your microphone. Please check the mic permission and try again.');
      return;
    }
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    setCtl({ requestPending: false });

    clearTimer();
    const endsAt = Date.now() + seconds * 1000;
    setCtl({ timeRemaining: seconds });
    Alert.alert('You can speak 🎤', `The host allowed you to speak for ${speakLabel(seconds)}.`);
    timerRef.current = setInterval(() => {
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        muteMyself();
        Alert.alert('Time is over', 'Your speaking time is finished. Raise your hand to ask again.');
      } else {
        setCtl({ timeRemaining: left });
      }
    }, 1000);
  };

  const setRequests = (list: SpeakRequest[]) => {
    requestsRef.current = list;
    setCtl({ requests: list });
  };

  // Actions that the screen can call
  useEffect(() => {
    setCtl({
      approve: (senderId, seconds) => {
        send({ type: 'SPEAK_GRANT', targetId: senderId, duration: seconds }, senderId);
        setRequests(requestsRef.current.filter((r) => r.senderId !== senderId));
      },
      deny: (senderId) => {
        send({ type: 'SPEAK_DENY', targetId: senderId }, senderId);
        setRequests(requestsRef.current.filter((r) => r.senderId !== senderId));
      },
      requestSpeak: () => {
        send({ type: 'SPEAK_REQUEST', senderName: lpRef.current?.identity });
        setCtl({ requestPending: true });
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = setTimeout(() => setCtl({ requestPending: false }), 60 * 1000);
        Alert.alert('Request sent ✋', 'The host has been asked. You can speak once the host allows it.');
      },
      stopMyMic: () => {
        muteMyself();
        send({ type: 'SPEAK_CANCEL' });
      },
      muteParticipant: (identity) => send({ type: 'HOST_MUTE', targetId: identity }, identity),
      grantParticipant: (identity, seconds) => send({ type: 'SPEAK_GRANT', targetId: identity, duration: seconds }, identity),
      muteAll: () => send({ type: 'HOST_MUTE', targetId: 'ALL' }),
    });
    return () => {
      clearTimer();
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      ctlState = CTL_DEFAULT;
      ctlListeners.forEach((l) => l());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Profile sharing: everybody tells everybody their avatar, and who the host is ──
  const hostUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!roomId) return;
    firestore()
      .collection('voice_rooms')
      .doc(roomId)
      .get()
      .then((d) => {
        hostUidRef.current = (d.data() as any)?.createdBy || null;
      })
      .catch(() => {});
  }, [roomId]);

  const myIdentity = localParticipant?.identity;
  const connectedNow = String(connectionState).toLowerCase() === 'connected';
  useEffect(() => {
    if (!connectedNow || !myIdentity) return;
    // Own tile
    setCtl({ profiles: { ...ctlState.profiles, [myIdentity]: { avatarUrl: userAvatarUrl || '', isHost: !!isHost } } });
    const announce = () =>
      send({
        type: 'PROFILE',
        uid: auth().currentUser?.uid || '',
        avatarUrl: userAvatarUrl || '',
        isHost: !!isHost,
      });
    announce();
    const first = setTimeout(announce, 1500);
    const timer = setInterval(announce, 15 * 1000);
    const onJoined = () => setTimeout(announce, 1200);
    room?.on(RoomEvent.ParticipantConnected, onJoined);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      room?.off(RoomEvent.ParticipantConnected, onJoined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedNow, myIdentity, userAvatarUrl, isHost, room]);

  // Incoming packets
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, participant: any) => {
      let data: any = null;
      try {
        data = JSON.parse(ctlDecoder.decode(payload));
      } catch (e) {
        return;
      }
      const type = String(data?.type || '').toUpperCase();
      const sender = participant?.identity;
      const me = lpRef.current?.identity;
      const fromHost = isHostParticipant(participant);

      if (type === 'PROFILE') {
        if (!sender) return;
        const hostUid = hostUidRef.current;
        const claimsHost = hostUid ? data.uid === hostUid : data.isHost === true;
        setCtl({
          profiles: {
            ...ctlState.profiles,
            [sender]: { avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '', isHost: claimsHost },
          },
        });
        return;
      }

      if (type === 'SPEAK_REQUEST') {
        if (!isHost || !sender) return;
        if (requestsRef.current.some((r) => r.senderId === sender)) return;
        setRequests([...requestsRef.current, { senderId: sender, senderName: data.senderName || sender }]);
      } else if (type === 'SPEAK_CANCEL') {
        if (!isHost) return;
        setRequests(requestsRef.current.filter((r) => r.senderId !== sender));
      } else if (type === 'SPEAK_GRANT') {
        if (!fromHost || data.targetId !== me) return;
        startSpeaking(Number(data.duration) || DEFAULT_SPEAK_SECONDS);
      } else if (type === 'SPEAK_DENY') {
        if (!fromHost || data.targetId !== me) return;
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        setCtl({ requestPending: false });
        Alert.alert('Request declined', 'The host did not allow the microphone right now.');
      } else if (type === 'HOST_MUTE') {
        if (!fromHost || isHost) return;
        if (data.targetId === me || data.targetId === 'ALL') {
          const wasOn = !!lpRef.current?.isMicrophoneEnabled;
          muteMyself();
          if (wasOn) Alert.alert('Muted by host', 'The host switched your microphone off.');
        }
      }
    };
    const onLeft = (p: any) => {
      if (requestsRef.current.some((r) => r.senderId === p?.identity)) {
        setRequests(requestsRef.current.filter((r) => r.senderId !== p?.identity));
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, isHost]);

  // Host: switch the mic ON once the room is connected (students start with the mic off, so nobody
  // depends on a mic that was opened while the connection was still starting)
  const hostMicInitRef = useRef(false);
  useEffect(() => {
    if (!isHost || hostMicInitRef.current) return;
    if (String(connectionState).toLowerCase() !== 'connected') return;
    hostMicInitRef.current = true;
    (async () => {
      // Give the audio engine a moment after connecting (a mic opened too early records silence on some phones)
      await new Promise((r) => setTimeout(r, 2000));
      for (let i = 0; i < 4; i++) {
        try {
          await lpRef.current?.setMicrophoneEnabled(true);
          return;
        } catch (e) {
          console.log('Host mic start failed (attempt ' + (i + 1) + '):', e);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    })();
  }, [connectionState, isHost]);

  // A student who is not allowed to speak must start muted
  useEffect(() => {
    if (isHost || String(connectionState).toLowerCase() !== 'connected') return;
    if (micOn && !allowedRef.current) {
      lpRef.current?.setMicrophoneEnabled(false).catch(() => {});
    }
  }, [connectionState, isHost, micOn]);

  return null;
};

// Reports "I am in this room" so the room cards can show how many people are really inside.
// A heartbeat every 25 seconds; the card counts only people seen in the last 70 seconds.
export const RoomPresenceReporter = ({ roomId }: { roomId?: string }) => {
  const connectionState = useConnectionState();
  const connected = String(connectionState).toLowerCase() === 'connected';
  useEffect(() => {
    const user = auth().currentUser;
    if (!roomId || !user || !connected) return;
    const ref = firestore().collection('voice_rooms').doc(roomId).collection('participants').doc(user.uid);
    const beat = () => {
      ref
        .set(
          {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            lastSeen: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 25 * 1000);
    return () => {
      clearInterval(timer);
      ref.delete().catch(() => {});
    };
  }, [roomId, connected]);
  return null;
};

// 🌊 Sound Waves Component (Left & Right of Avatar ONLY when Mic is ON & Active)
const MicWaveBars = ({ isActive }: { isActive: boolean }) => {
  const anim1 = useRef(new Animated.Value(4)).current;
  const anim2 = useRef(new Animated.Value(10)).current;
  const anim3 = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (isActive) {
      const createWave = (val: Animated.Value, minH: number, maxH: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(val, { toValue: maxH, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(val, { toValue: minH, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          ])
        );
      };

      const w1 = createWave(anim1, 4, 18, 260);
      const w2 = createWave(anim2, 6, 24, 320);
      const w3 = createWave(anim3, 3, 16, 220);

      w1.start();
      w2.start();
      w3.start();

      return () => {
        w1.stop();
        w2.stop();
        w3.stop();
      };
    } else {
      anim1.setValue(4);
      anim2.setValue(4);
      anim3.setValue(4);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <View style={styles.waveRow}>
      <Animated.View style={[styles.waveBar, { height: anim1 }]} />
      <Animated.View style={[styles.waveBar, { height: anim2 }]} />
      <Animated.View style={[styles.waveBar, { height: anim3 }]} />
    </View>
  );
};

// ─── MINI SQUARE PARTICIPANT TILE ───
const StudyParticipantTile = ({ 
  participant, 
  fallbackAvatarUrl, 
  isHandRaised, 
  totalCount,
  viewerIsHost,
  onHostMicPress,
}: any) => {
  const isLocal = participant?.isLocal;
  const ctlForTile = useStudyCtl();
  const sharedProfile = ctlForTile.profiles[participant?.identity];
  const isMicOn = Boolean(participant?.isMicrophoneEnabled);
  const isSpeaking = Boolean(participant?.isSpeaking && isMicOn);
  
  // Chosen avatar or profile picture; with none, the first letter of the name is shown (no default cartoon)
  let avatarUrl = fallbackAvatarUrl || '';
  let participantHand = isHandRaised;
  let participantIsHost = false;

  try {
    if (participant?.metadata) {
      const meta = JSON.parse(participant.metadata);
      if (typeof meta?.avatarUrl === 'string') avatarUrl = meta.avatarUrl;
      if (typeof meta?.isHandRaised === 'boolean') participantHand = meta.isHandRaised;
      if (meta?.isHost === true) participantIsHost = true;
    }
  } catch (e) {}
  // Shared profile (sent as a data packet) wins over metadata
  if (sharedProfile) {
    if (sharedProfile.avatarUrl) avatarUrl = sharedProfile.avatarUrl;
    if (sharedProfile.isHost) participantIsHost = true;
  }
  if (isLocal && viewerIsHost) participantIsHost = true;

  const handBounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (participantHand) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(handBounceAnim, { toValue: -6, duration: 260, useNativeDriver: true }),
          Animated.timing(handBounceAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      handBounceAnim.setValue(0);
    }
  }, [participantHand]);

  return (
    <View style={[
      styles.squareStudyTile,
      totalCount === 1 && styles.singleSquareStudyTile,
      participantIsHost && styles.hostTileBorder,
      isSpeaking && styles.speakingTileBorder,
      participantHand && styles.handRaisedBorder
    ]}>
      {/* Speaking Indicator */}
      {isSpeaking && (
        <View style={styles.speakingBadge}>
          <Volume2 size={10} color="#10B981" />
          <Text style={styles.speakingBadgeText}>Speaking</Text>
        </View>
      )}

      {/* Mic Status. The host can tap it on another person's tile: mic on = mute, mic off = allow to speak. */}
      {viewerIsHost && !isLocal ? (
        <TouchableOpacity
          style={[styles.tileMicBadge, isMicOn ? styles.tileMicActive : styles.tileMicMuted, styles.tileMicHostTappable]}
          onPress={() => onHostMicPress && onHostMicPress(participant, isMicOn)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          {isMicOn ? <Mic size={12} color="#FFF" /> : <MicOff size={12} color="#FFF" />}
        </TouchableOpacity>
      ) : (
        <View style={[styles.tileMicBadge, isMicOn ? styles.tileMicActive : styles.tileMicMuted]}>
          {isMicOn ? <Mic size={11} color="#FFF" /> : <MicOff size={11} color="#FFF" />}
        </View>
      )}

      {/* Raised Hand Badge */}
      {participantHand && (
        <Animated.View style={[styles.handBadgeFloating, { transform: [{ translateY: handBounceAnim }] }]}>
          <Text style={{ fontSize: 16 }}>✋</Text>
        </Animated.View>
      )}

      {/* Avatar Container with Waves */}
      <View style={styles.avatarWaveWrapper}>
        <MicWaveBars isActive={isMicOn && (isSpeaking || isLocal)} />

        <View style={[styles.avatarGlowContainer, isSpeaking && styles.avatarSpeakingGlow]}>
          <AvatarCircle uri={avatarUrl} name={participant?.identity} style={styles.avatarImg} textSize={24} />
        </View>

        <MicWaveBars isActive={isMicOn && (isSpeaking || isLocal)} />
      </View>

      <Text style={styles.nameText} numberOfLines={1}>
        {isLocal ? `${participant?.identity} (You)` : participant?.identity}
      </Text>
      {participantIsHost && (
        <View style={styles.hostPill}>
          <Text style={styles.hostPillText}>👑 HOST</Text>
        </View>
      )}
    </View>
  );
};

// ─── MAIN ROOM VIEW ───
export const StudyRoomView = ({ safeExit, onMinimize, roomTitle, isHost, roomId, userAvatarUrl }: any) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const ctl = useStudyCtl();

  // The host: first request waiting in the queue, or a person the host picked to allow
  const [grantTarget, setGrantTarget] = useState<{ identity: string } | null>(null);
  const [pickedSeconds, setPickedSeconds] = useState<number>(DEFAULT_SPEAK_SECONDS);
  const waitingRequest = isHost ? ctl.requests[0] : undefined;

  // Host first, then everyone else
  const sortedParticipants = React.useMemo(() => {
    const list = [...participants];
    list.sort((a: any, b: any) => ((isHostParticipant(b) || (b.isLocal && isHost)) ? 1 : 0) - ((isHostParticipant(a) || (a.isLocal && isHost)) ? 1 : 0));
    return list;
  }, [participants, ctl.profiles, isHost]);

  // Chat & Call States
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // 🚀 Native Smooth Keyboard Animation Driver (Zero Lag)

  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth().currentUser;
  const currentUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  // Keyboard handling for the in-call chat card: the card sits right above the keyboard and shrinks to fit,
  // so the message list, emoji bar and input are always visible (it no longer slides up off the screen).
  const [kbHeight, setKbHeight] = useState(0);
  const [kbOpen, setKbOpen] = useState(false);
  const [backdropH, setBackdropH] = useState(SCREEN_HEIGHT);
  const kbOnRef = useRef(false);
  const backdropRef = useRef<any>(null);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: any) => {
      kbOnRef.current = true;
      setKbOpen(true);
      const h = e?.endCoordinates?.height || 0;
      if (Platform.OS === 'ios') { setKbHeight(h); return; }
      // Android: measure how much of the keyboard really covers the bottom of this screen.
      // If the window already shrank by itself the overlap is 0, otherwise it is the keyboard height.
      const kbTop = e?.endCoordinates?.screenY;
      setTimeout(() => {
        if (!kbOnRef.current) return;
        const node = backdropRef.current;
        if (!node || !node.measureInWindow || typeof kbTop !== 'number') { setKbHeight(0); return; }
        node.measureInWindow((_x: number, y: number, _w: number, height: number) => {
          setKbHeight(Math.max(0, Math.round(y + height - kbTop)));
        });
      }, 150);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      kbOnRef.current = false;
      setKbOpen(false);
      setKbHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const chatCardHeight = Math.min(
    SCREEN_HEIGHT * 0.58,
    Math.max(260, backdropH - kbHeight - 90),
  );

  // Sync LiveKit Metadata when Connected
  useEffect(() => {
    let isCancelled = false;
    const syncMetadata = async () => {
      try {
        // Always sent (also when no avatar was chosen), so everybody sees the same thing and the host is marked
        if (!isCancelled && String(connectionState).toLowerCase() === 'connected' && localParticipant) {
          await localParticipant.setMetadata(JSON.stringify({ 
            avatarUrl: userAvatarUrl || '',
            isHandRaised: isHandRaised,
            isHost: !!isHost,
          }));
        }
      } catch (e) {}
    };

    syncMetadata();
    return () => {
      isCancelled = true;
    };
  }, [connectionState, localParticipant, userAvatarUrl, isHandRaised, isHost]);

  // Firestore Realtime Chat
  // The unread badge counts only NEW messages from other people that arrive while the chat is closed.
  // (It used to add 1 on every snapshot - also the first load and the "sent" confirmation of your own
  // message - so the badge always showed 1 and one message could count twice.)
  const showChatRef = useRef(false);
  showChatRef.current = showChatModal;
  useEffect(() => {
    if (!roomId) return;
    const joinedAt = Date.now() - 3000;
    const unsub = firestore()
      .collection('voice_rooms')
      .doc(roomId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snap) => {
        if (!snap) return;
        const list: any[] = [];
        const seen = new Set<string>();
        snap.forEach((doc) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          list.push({ id: doc.id, ...doc.data() });
        });
        setMessages(list);

        let fresh = 0;
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added' || ch.doc.metadata.hasPendingWrites) return;
          const d: any = ch.doc.data();
          if (d?.senderId === auth().currentUser?.uid) return;
          const ms = d?.createdAt && typeof d.createdAt.toMillis === 'function' ? d.createdAt.toMillis() : 0;
          if (ms >= joinedAt) fresh += 1;
        });
        if (fresh > 0 && !showChatRef.current) setUnreadCount((c) => c + fresh);
      });

    return () => unsub();
  }, [roomId]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || !roomId) return;
    setChatInputText('');

    try {
      await firestore().collection('voice_rooms').doc(roomId).collection('messages').add({
        text,
        senderId: currentUser?.uid || 'guest',
        senderName: currentUserName,
        avatarUrl: userAvatarUrl || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.log('Error sending room message:', e);
    }
  };

  // Host: switches the own mic freely. Everyone else: the mic opens only after the host allows it.
  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      if (isHost) {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      } else if (isMicrophoneEnabled) {
        ctl.stopMyMic();
      } else if (ctl.requestPending) {
        Alert.alert('Already requested', 'Your request is with the host. Please wait for the host to allow it.');
      } else {
        ctl.requestSpeak();
      }
    } catch (e) {
      console.log('Mic toggle error:', e);
    }
  };

  // Host taps the mic icon on someone's tile
  const handleHostMicPress = (participant: any, micIsOn: boolean) => {
    if (!participant?.identity) return;
    if (micIsOn) ctl.muteParticipant(participant.identity);
    else {
      setPickedSeconds(DEFAULT_SPEAK_SECONDS);
      setGrantTarget({ identity: participant.identity });
    }
  };

  const toggleHandRaise = () => {
    setIsHandRaised(prev => !prev);
  };

  // Minimize: the room stays connected (audio keeps playing) and the user goes back to the app.
  const handleMinimize = React.useCallback(() => {
    // Close the chat popup and the keyboard first, so no blank window is left behind the bubble
    Keyboard.dismiss();
    setShowChatModal(false);
    setTimeout(() => {
      if (typeof onMinimize === 'function') onMinimize();
      else safeExit();
    }, 300);
  }, [onMinimize, safeExit]);

  // The phone's Back button minimizes the room instead of leaving it
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleMinimize();
      return true;
    });
    return () => sub.remove();
  }, [handleMinimize]);

  // Share the room: opens the phone's share sheet (WhatsApp, Telegram, ...)
  const handleShareRoom = async () => {
    if (!roomId) {
      Alert.alert('Share', 'This room cannot be shared right now.');
      return;
    }
    try {
      await Share.share({
        message:
          `Join "${roomTitle || 'Study Room'}" live on ECC - English Conversation Club 🎧\n` +
          `https://ecc-master-english-fa596.web.app/room/${roomId}`,
      });
    } catch (e) {
      console.log('Share room error:', e);
    }
  };

  const handleLeaveCall = async () => {
    try {
      if (isHost && roomId) {
        await firestore().collection('voice_rooms').doc(roomId).delete();
      }
      if (room) {
        await room.disconnect();
      }
    } catch (e) {
      console.log('Error leaving call:', e);
    } finally {
      safeExit();
    }
  };

  return (
    <View style={styles.rootWrapper}>
      {/* 🌟 Background Image with Clean Scaling */}
      <ImageBackground
        source={require('../../../assets/study-room.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* ─── HEADER ─── */}
        <View style={[styles.header, { paddingTop: STATUSBAR_SAFE_HEIGHT }]}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleMinimize}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronDown color="#FFFFFF" size={22} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{roomTitle || 'Study Room'}</Text>
            <View style={styles.statusRow}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.participantCount}>
                {participants.length} Active • Audio HD Live
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.headerIconBtn, { marginRight: 8 }]}
            onPress={handleShareRoom}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Share2 color="#FFFFFF" size={20} />
          </TouchableOpacity>

          <View style={styles.headerAvatarBadge}>
            <AvatarCircle uri={userAvatarUrl} name={currentUserName} style={styles.headerAvatarImg} textSize={18} />
          </View>
        </View>

        {/* ─── PARTICIPANTS LIST ─── */}
        <View style={styles.mainContent}>
          <FlatList
            data={sortedParticipants}
            keyExtractor={(item) => item.sid || item.identity}
            key={participants.length <= 1 ? 'single-col' : 'multi-col'}
            numColumns={participants.length <= 1 ? 1 : 2}
            contentContainerStyle={[
              styles.gridContainer,
              participants.length <= 1 && styles.singleGridContainer
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <StudyParticipantTile 
                participant={item} 
                fallbackAvatarUrl={item.isLocal ? userAvatarUrl : ''}
                isHandRaised={item.isLocal ? isHandRaised : false}
                totalCount={participants.length}
                viewerIsHost={!!isHost}
                onHostMicPress={handleHostMicPress}
              />
            )}
          />
        </View>

        {/* ─── HOST TOOLS / SPEAKING TIMER ─── */}
        {isHost ? (
          <View style={styles.hostStrip}>
            <Text style={styles.hostStripText} numberOfLines={2}>
              👑 You are the host. Tap a mic icon to mute or allow someone.
              {ctl.requests.length > 0 ? `  ✋ ${ctl.requests.length} waiting` : ''}
            </Text>
            <TouchableOpacity style={styles.muteAllBtn} onPress={() => ctl.muteAll()} activeOpacity={0.8}>
              <MicOff size={13} color="#FFF" />
              <Text style={styles.muteAllText}>Mute all</Text>
            </TouchableOpacity>
          </View>
        ) : ctl.timeRemaining !== null ? (
          <View style={[styles.hostStrip, { borderColor: 'rgba(16,185,129,0.5)' }]}>
            <Text style={[styles.hostStripText, { color: '#34D399' }]}>
              🎤 You can speak. Time left: {formatSpeakTime(ctl.timeRemaining)}
            </Text>
          </View>
        ) : ctl.requestPending ? (
          <View style={styles.hostStrip}>
            <Text style={styles.hostStripText}>✋ Request sent. Waiting for the host to allow your mic...</Text>
          </View>
        ) : (
          <View style={styles.hostStrip}>
            <Text style={styles.hostStripText}>🔇 Only the host can open your mic. Tap the mic button to ask.</Text>
          </View>
        )}

        {/* ─── BOTTOM CONTROLS BAR ─── */}
        <View style={styles.controlsWrapper}>
          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={[styles.controlBtn, isMicrophoneEnabled ? styles.btnActive : styles.btnMuted]}
              onPress={toggleMic}
              activeOpacity={0.7}
            >
              {isMicrophoneEnabled ? <Mic color="#FFF" size={22} /> : <MicOff color="#FFF" size={22} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, isHandRaised ? styles.btnHandActive : styles.btnChat]} 
              onPress={toggleHandRaise}
              activeOpacity={0.8}
            >
              <Hand color={isHandRaised ? "#FFF" : "#94A3B8"} size={22} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, showChatModal ? styles.btnActive : styles.btnChat]} 
              onPress={() => {
                setShowChatModal(prev => !prev);
                setUnreadCount(0);
              }}
              activeOpacity={0.8}
            >
              <MessageSquare color="#FFF" size={22} />
              {unreadCount > 0 && (
                <View style={styles.chatNotificationDot}>
                  <Text style={styles.chatNotificationText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, styles.endCallBtn]} 
              onPress={handleLeaveCall}
              activeOpacity={0.8}
            >
              <PhoneOff color="#FFF" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 🔔 HOST: SPEAK REQUEST / ALLOW SOMEONE TO SPEAK ─── */}
        <Modal visible={!!waitingRequest || !!grantTarget} transparent animationType="fade" onRequestClose={() => { setGrantTarget(null); }}>
          <View style={styles.approvalOverlay}>
            <View style={styles.approvalCard}>
              <Text style={styles.approvalTitle}>{waitingRequest ? 'Request to speak ✋' : 'Allow to speak 🎤'}</Text>
              <Text style={styles.approvalSub}>
                <Text style={{ fontWeight: '800', color: '#FFF' }}>
                  {waitingRequest ? waitingRequest.senderName : grantTarget?.identity}
                </Text>
                {waitingRequest ? ' wants to turn on the mic.' : ' will be able to speak for the time you choose.'}
              </Text>

              <Text style={styles.approvalLabel}>Speaking time</Text>
              <View style={styles.timeRow}>
                {SPEAK_DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.timeChip, pickedSeconds === d && styles.timeChipSelected]}
                    onPress={() => setPickedSeconds(d)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timeChipText, pickedSeconds === d && styles.timeChipTextSelected]}>{speakLabel(d)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.approvalActions}>
                <TouchableOpacity
                  style={[styles.approvalBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    if (waitingRequest) ctl.deny(waitingRequest.senderId);
                    else setGrantTarget(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.approvalBtnText}>{waitingRequest ? 'Deny' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approvalBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => {
                    if (waitingRequest) ctl.approve(waitingRequest.senderId, pickedSeconds);
                    else if (grantTarget) {
                      ctl.grantParticipant(grantTarget.identity, pickedSeconds);
                      setGrantTarget(null);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.approvalBtnText}>Allow</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── 💬 CENTER CHAT MODAL ─── */}
        <Modal visible={showChatModal} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setShowChatModal(false)}>
          <View
            ref={backdropRef}
            collapsable={false}
            style={styles.chatCenterBackdrop}
            onLayout={(e) => setBackdropH(e.nativeEvent.layout.height)}
          >
            <TouchableWithoutFeedback 
              onPress={() => {
                Keyboard.dismiss();
                setShowChatModal(false);
              }}
            >
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
              styles.chatCenterCard,
              { height: chatCardHeight, marginBottom: kbOpen ? 8 + kbHeight : 88 },
            ]}>
              {/* Header */}
              <View style={styles.chatSheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.chatHeaderCircleIcon}>
                    <MessageSquare size={16} color="#38BDF8" />
                  </View>
                  <Text style={styles.chatSheetTitle}>In-call messages</Text>
                </View>
                <TouchableOpacity 
                  style={styles.chatCloseCircleBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowChatModal(false);
                  }} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Messages List */}
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isMyMessage = item.senderId === currentUser?.uid;
                  return (
                    <View style={[
                      styles.messageRow,
                      isMyMessage ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                    ]}>
                      {!isMyMessage && (
                        <AvatarCircle uri={item.avatarUrl} name={item.senderName} style={styles.chatAvatarThumb} textSize={12} />
                      )}
                      <View style={[
                        styles.messageBubble,
                        isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
                      ]}>
                        {!isMyMessage && (
                          <Text style={styles.senderNameLabel}>{item.senderName}</Text>
                        )}
                        <Text style={[styles.messageContentText, isMyMessage ? { color: '#FFF' } : { color: '#F1F5F9' }]}>
                          {item.text}
                        </Text>
                      </View>
                      {isMyMessage && (
                        <AvatarCircle uri={item.avatarUrl || userAvatarUrl} name={currentUserName} style={styles.chatAvatarThumb} textSize={12} />
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 36 }}>
                    <View style={styles.emptyChatCircle}>
                      <Smile size={26} color="#38BDF8" />
                    </View>
                    <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 10, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 }}>
                      Messages can only be seen by people in this study room.
                    </Text>
                  </View>
                }
              />

              {/* Quick Emojis Bar */}
              <View style={styles.quickEmojiBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
                  {QUICK_EMOJIS.map((emoji) => (
                    <TouchableOpacity 
                      key={emoji} 
                      onPress={() => handleSendMessage(emoji)}
                      activeOpacity={0.7}
                      style={styles.emojiQuickBubble}
                    >
                      <Text style={{ fontSize: 19 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Chat Input Container */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatTextInput}
                  placeholder="Send an in-call message..."
                  placeholderTextColor="#64748B"
                  value={chatInputText}
                  onChangeText={setChatInputText}
                  onSubmitEditing={() => handleSendMessage()}
                />
                <TouchableOpacity 
                  style={[styles.sendChatBtn, !chatInputText.trim() && { opacity: 0.5 }]} 
                  onPress={() => handleSendMessage()}
                  disabled={!chatInputText.trim()}
                  activeOpacity={0.8}
                >
                  <Send size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

// ─── EXPORT MAIN SCREEN ───
// The room itself now lives in CallSessionProvider (an overlay above the navigator), exactly like
// Class Rooms. This screen only starts the call and returns, so the user can minimize the room,
// use the rest of the app, and come back through the floating bubble without being disconnected.
export default function StudyRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl } = route?.params || {};
  const { startCall } = useCallSession();
  const startedRef = useRef(false);
  // Remove this thin "starter" route from the navigator once the call runs in the overlay.
  // A plain goBack() right after navigate() can be ignored while the screen is still animating in,
  // which left this dark "joining" screen behind the minimized call bubble. So we retry safely.
  const leftRef = useRef(false);
  const leaveRoute = () => {
    leftRef.current = true;
    const pop = () => {
      try {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Dashboard');
      } catch (_) {}
    };
    InteractionManager.runAfterInteractions(pop);
    setTimeout(() => { if (navigation.isFocused()) pop(); }, 700);
    setTimeout(() => { if (navigation.isFocused()) pop(); }, 1600);
  };
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (leftRef.current) leaveRoute();
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      Alert.alert('Error', 'Room token is missing.');
      navigation.goBack();
      return;
    }
    startCall({ serverUrl, token, roomType: 'study', roomTitle, isHost, roomId, userAvatarUrl });
    leaveRoute();
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#38BDF8" />
      <Text style={styles.loadingText}>Connecting to HD Audio Room...</Text>
    </View>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  flexOne: {
    flex: 1,
    backgroundColor: '#070D18',
  },
  rootWrapper: {
    flex: 1,
    backgroundColor: '#070D18',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 24, 0.60)', // Perfect balance: image elements are clearly visible, text & tiles remain sharp
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070D18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  roomTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  participantCount: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  headerAvatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  gridContainer: {
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  singleGridContainer: {
    alignItems: 'center',
  },
  
  // ─── SQUARE TILE ───
  squareStudyTile: {
    flex: 0.5,
    maxWidth: (SCREEN_WIDTH - 36) / 2,
    height: 146,
    margin: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.82)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    position: 'relative',
    elevation: 4,
  },
  singleSquareStudyTile: {
    width: 175,
    maxWidth: 175,
    flex: 0,
  },
  speakingTileBorder: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  handRaisedBorder: {
    borderColor: '#F59E0B',
  },
  hostTileBorder: {
    borderColor: '#FBBF24',
    borderWidth: 2,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  hostPill: {
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.6)',
  },
  hostPillText: {
    color: '#FBBF24',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tileMicHostTappable: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hostStrip: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostStripText: {
    flex: 1,
    color: '#FBBF24',
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  muteAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  muteAllText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  approvalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  approvalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  approvalSub: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 14,
  },
  approvalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  timeChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  timeChipTextSelected: {
    color: '#FFFFFF',
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approvalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  approvalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  speakingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  speakingBadgeText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  tileMicBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileMicActive: {
    backgroundColor: '#10B981',
  },
  tileMicMuted: {
    backgroundColor: '#EF4444',
  },
  handBadgeFloating: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#F59E0B',
    elevation: 6,
    zIndex: 10,
  },
  avatarWaveWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
  },
  avatarGlowContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarSpeakingGlow: {
    borderColor: '#10B981',
    elevation: 8,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 30,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  nameText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: '92%',
  },

  // ─── CONTROLS ───
  controlsWrapper: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    paddingTop: 8,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.8)',
    elevation: 8,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  btnActive: {
    backgroundColor: '#2563EB',
  },
  btnMuted: {
    backgroundColor: '#EF4444',
  },
  btnHandActive: {
    backgroundColor: '#D97706',
  },
  btnChat: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    position: 'relative',
  },
  endCallBtn: {
    backgroundColor: '#DC2626',
  },
  chatNotificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatNotificationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // ─── CENTER FLOATING CHAT CARD ───
  chatCenterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chatCenterCard: {
    width: Math.min(SCREEN_WIDTH * 0.95, 460),
    height: SCREEN_HEIGHT * 0.58,
    backgroundColor: '#0F172A',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#334155',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    overflow: 'hidden',
    marginBottom: 88,
  },
  chatSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  chatHeaderCircleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatCloseCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSheetTitle: {
    color: '#F8FAFC',
    fontSize: 15.5,
    fontWeight: '800',
  },
  emptyChatCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    gap: 8,
  },
  chatAvatarThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  senderNameLabel: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '800',
    marginBottom: 2,
  },
  messageContentText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  quickEmojiBar: {
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0B1120',
  },
  emojiQuickBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#0F172A',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 24,
    fontSize: 13.5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
});