import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useConnectionState,
  VideoTrack,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  MessageCircle,
  Smile,
  ScreenShare,
  ScreenShareOff,
  Send,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { useCallSession } from '../home/screens/CallSessionProvider';
import { useTheme } from '../../hooks/useTheme';

const DEFAULT_AVATAR =
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest';

const REACTIONS = ['👍', '👏', '❤️', '😂', '😮', '🎉'];

// ─── Data-channel helpers ───
// Chat aur emoji reactions LiveKit ke data channel se jaate hain (koi extra
// server nahi chahiye). TextEncoder/TextDecoder har RN version me nahi hota,
// isliye fallback ke saath.
const encodeUtf8 = (str: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
  const e = encodeURIComponent(str);
  const out: number[] = [];
  for (let i = 0; i < e.length; i++) {
    if (e[i] === '%') {
      out.push(parseInt(e.substr(i + 1, 2), 16));
      i += 2;
    } else {
      out.push(e.charCodeAt(i));
    }
  }
  return new Uint8Array(out);
};

const decodeUtf8 = (bytes: Uint8Array): string => {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let s = '';
  bytes.forEach((b) => {
    s += '%' + (b < 16 ? '0' : '') + b.toString(16);
  });
  return decodeURIComponent(s);
};

type ChatMsg = { id: string; mine: boolean; text: string; ts: number };
type FloatingEmoji = { id: string; emoji: string; left: number };

/** Ek emoji upar tairta hua gayab hota hai */
const FloatingReaction = ({
  emoji,
  left,
  onDone,
}: {
  emoji: string;
  left: number;
  onDone: () => void;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(onDone);
  }, []);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 120,
        left,
        fontSize: 34,
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
};

/**
 * VideoSessionView
 * -----------------
 * ClassRoomView se JAAN-BOOJH KAR alag hai — koi grid, koi chhoti tiles.
 * Sirf 2 log, screen upar-neeche (half-half) — WhatsApp / Meet ke 1-to-1
 * call jaisa.
 *
 * Features: mic on/off, camera on/off, camera switch, screen share,
 * chat, emoji reactions, minimize, end call.
 */
export const VideoSessionView = ({
  safeExit,
  onMinimize,
  otherPersonName,
  otherPersonAvatarUrl,
  userAvatarUrl,
}: any) => {
  // Accent colour follows the app theme chosen in Settings
  const themeContext = useTheme() as any;
  const accent: string = themeContext?.theme?.colors?.primary || '#2563EB';

  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant() as any;
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const remoteParticipant = remoteParticipants[0]; // 1-to-1 — sirf ek hi remote participant

  // 🔎 DEBUG: connection kyu nahi ban raha ye Metro me dikhega
  useEffect(() => {
    console.log('[VideoSession] connectionState =', connectionState);
  }, [connectionState]);
  useEffect(() => {
    const room = localParticipant?.room;
    if (!room) return;
    const onDisc = (reason?: any) => console.log('[VideoSession] disconnected, reason =', reason);
    const onFail = (err: any) => console.log('[VideoSession] media/connection error =', err?.message || err);
    room.on(RoomEvent.Disconnected, onDisc);
    room.on(RoomEvent.MediaDevicesError, onFail);
    return () => {
      room.off(RoomEvent.Disconnected, onDisc);
      room.off(RoomEvent.MediaDevicesError, onFail);
    };
  }, [localParticipant]);

  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  const localVideoTrack = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera
  );
  const remoteVideoTrack = tracks.find(
    (t) =>
      !t.participant.isLocal &&
      t.source === Track.Source.Camera &&
      t.publication?.isSubscribed !== false &&
      !!t.publication?.track
  );
  // Samne wale ne screen share kiya ho to upar wahi dikhate hain
  const remoteScreenTrack = tracks.find(
    (t) =>
      !t.participant.isLocal &&
      t.source === Track.Source.ScreenShare &&
      t.publication?.isSubscribed !== false &&
      !!t.publication?.track
  );

  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // ─── CHAT + REACTIONS STATE ───
  const [chatOpen, setChatOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const chatOpenRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  chatOpenRef.current = chatOpen;

  const room = localParticipant?.room;

  const addFloating = useCallback((emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const left = 30 + Math.random() * 200;
    setFloating((f) => [...f, { id, emoji, left }]);
  }, []);

  // Incoming chat / reactions
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      try {
        const data = JSON.parse(decodeUtf8(payload));
        if (topic === 'chat' && typeof data.text === 'string') {
          setMessages((m) => [
            ...m,
            { id: `${data.ts}_${Math.random()}`, mine: false, text: data.text, ts: data.ts },
          ]);
          if (!chatOpenRef.current) setUnread((u) => u + 1);
        } else if (topic === 'reaction' && typeof data.emoji === 'string') {
          addFloating(data.emoji);
        }
      } catch (e) {
        console.log('data parse error:', e);
      }
    };
    room.on(RoomEvent.DataReceived, onData as any);
    return () => {
      room.off(RoomEvent.DataReceived, onData as any);
    };
  }, [room, addFloating]);

  useEffect(() => {
    if (chatOpen) {
      setUnread(0);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [chatOpen, messages.length]);

  const sendChat = async () => {
    const text = draft.trim();
    if (!text || !localParticipant) return;
    const ts = Date.now();
    try {
      await localParticipant.publishData(encodeUtf8(JSON.stringify({ text, ts })), {
        reliable: true,
        topic: 'chat',
      });
      setMessages((m) => [...m, { id: `${ts}_me`, mine: true, text, ts }]);
      setDraft('');
    } catch (e) {
      console.log('chat send error:', e);
      Alert.alert('Error', 'Could not send the message.');
    }
  };

  const sendReaction = async (emoji: string) => {
    setEmojiOpen(false);
    addFloating(emoji); // apni screen par turant
    try {
      await localParticipant?.publishData(encodeUtf8(JSON.stringify({ emoji })), {
        reliable: false,
        topic: 'reaction',
      });
    } catch (e) {
      console.log('reaction send error:', e);
    }
  };

  // ─── CONTROLS ───
  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  const switchCamera = () => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    (pub?.track as any)?.switchCamera?.();
    setIsFrontCamera((v) => !v);
  };

  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (e: any) {
      console.log('screen share error:', e);
      Alert.alert(
        'Screen share',
        'Could not start screen sharing. Please allow the permission and try again.'
      );
    }
  };

  const handleEndCall = async () => {
    try {
      await localParticipant.room?.disconnect();
    } catch (e) {
      console.log('disconnect error:', e);
    }
    safeExit();
  };

  const remoteTitle = otherPersonName || remoteParticipant?.identity || 'Waiting...';
  // Android me StatusBar translucent hai, isliye top controls ko uske neeche rakhte hain
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const sharingActive = !!remoteScreenTrack || !!isScreenShareEnabled;

  // Screen share ke dauran dono ke camera chhote tiles me (top-right)
  const renderPip = () => (
    <View style={[styles.pipCol, { top: topInset + 12 }]}>
      <View style={styles.pipTile}>
        {remoteVideoTrack ? (
          <VideoTrack trackRef={remoteVideoTrack} style={styles.video} objectFit="cover" />
        ) : (
          <Image source={{ uri: otherPersonAvatarUrl || DEFAULT_AVATAR }} style={styles.pipAvatar} />
        )}
      </View>
      <View style={styles.pipTile}>
        {isCameraEnabled && localVideoTrack ? (
          <VideoTrack trackRef={localVideoTrack} style={styles.video} objectFit="cover" mirror={isFrontCamera} />
        ) : (
          <Image source={{ uri: userAvatarUrl || DEFAULT_AVATAR }} style={styles.pipAvatar} />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {sharingActive ? (
        /* ─── SCREEN SHARE: POORI SCREEN ─── */
        <View style={StyleSheet.absoluteFill}>
          {remoteScreenTrack ? (
            <VideoTrack trackRef={remoteScreenTrack} style={styles.video} objectFit="contain" />
          ) : (
            <View style={styles.avatarFallback}>
              <ScreenShare color="#38BDF8" size={44} />
              <Text style={styles.waitingText}>You are sharing your screen</Text>
              <TouchableOpacity style={styles.stopShareBtn} onPress={toggleScreenShare}>
                <Text style={styles.stopShareText}>Stop sharing</Text>
              </TouchableOpacity>
            </View>
          )}
          {!!remoteScreenTrack && (
            <View style={[styles.nameLabelPill, { bottom: 88 }]}>
              <Text style={styles.nameLabelText}>{remoteTitle} · Screen share</Text>
            </View>
          )}
          {renderPip()}
        </View>
      ) : (
        <>
          {/* ─── TOP HALF — Remote participant ─── */}
          <View style={styles.half}>
            {remoteVideoTrack ? (
              <VideoTrack trackRef={remoteVideoTrack} style={styles.video} objectFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Image
                  source={{ uri: otherPersonAvatarUrl || DEFAULT_AVATAR }}
                  style={styles.avatarImg}
                />
                <Text style={styles.waitingText}>
                  {remoteParticipant
                    ? 'Camera off'
                    : `Waiting for ${otherPersonName || 'the other participant'}...`}
                </Text>
              </View>
            )}
            <View style={styles.nameLabelPill}>
              <Text style={styles.nameLabelText}>{remoteTitle}</Text>
            </View>
          </View>

          {/* ─── BOTTOM HALF — Local participant (aap) ─── */}
          <View style={styles.half}>
            {isCameraEnabled && localVideoTrack ? (
              <VideoTrack
                trackRef={localVideoTrack}
                style={styles.video}
                objectFit="cover"
                mirror={isFrontCamera}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Image source={{ uri: userAvatarUrl || DEFAULT_AVATAR }} style={styles.avatarImg} />
                {!isCameraEnabled && <Text style={styles.waitingText}>Camera off</Text>}
              </View>
            )}
            {/* controls bar ke upar rakhe hain (bottom: 88) */}
            <View style={[styles.nameLabelPill, { bottom: 88 }]}>
              <Text style={styles.nameLabelText}>You</Text>
            </View>
            {!isMicrophoneEnabled && (
              <View style={[styles.micOffBadge, { bottom: 88 }]}>
                <MicOff size={12} color="#FFF" />
              </View>
            )}
          </View>
        </>
      )}

      {connectionState !== 'connected' && (
        <View style={[styles.reconnectingBanner, { top: topInset + 14 }]}>
          <ActivityIndicator size="small" color="#FBBF24" />
          <Text style={styles.reconnectingText}>Connecting...</Text>
        </View>
      )}

      {/* ─── FLOATING EMOJI REACTIONS ─── */}
      {floating.map((f) => (
        <FloatingReaction
          key={f.id}
          emoji={f.emoji}
          left={f.left}
          onDone={() => setFloating((list) => list.filter((x) => x.id !== f.id))}
        />
      ))}

      {/* ─── MINIMIZE: TOP-LEFT ─── */}
      {onMinimize && (
        <TouchableOpacity
          style={[styles.minimizeBtn, { top: topInset + 10 }]}
          onPress={onMinimize}
          activeOpacity={0.8}
        >
          <ChevronDown color="#FFF" size={22} />
        </TouchableOpacity>
      )}

      {/* ─── EMOJI PICKER ROW ─── */}
      {emojiOpen && (
        <View style={styles.emojiBar}>
          {REACTIONS.map((e) => (
            <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={styles.emojiBtn}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ─── CONTROLS: SAB EK HI ROW ME (neeche) ─── */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, !isMicrophoneEnabled && styles.controlBtnOff]}
          onPress={toggleMic}
          activeOpacity={0.8}
        >
          {isMicrophoneEnabled ? <Mic color="#FFF" size={20} /> : <MicOff color="#FFF" size={20} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnOff]}
          onPress={toggleCamera}
          activeOpacity={0.8}
        >
          {isCameraEnabled ? <VideoIcon color="#FFF" size={20} /> : <VideoOff color="#FFF" size={20} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={switchCamera} activeOpacity={0.8}>
          <SwitchCamera color="#FFF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            setEmojiOpen(false);
            setChatOpen(true);
          }}
          activeOpacity={0.8}
        >
          <MessageCircle color="#FFF" size={20} />
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, emojiOpen && { backgroundColor: accent }]}
          onPress={() => setEmojiOpen((v) => !v)}
          activeOpacity={0.8}
        >
          <Smile color="#FFF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isScreenShareEnabled && { backgroundColor: accent }]}
          onPress={toggleScreenShare}
          activeOpacity={0.8}
        >
          {isScreenShareEnabled ? (
            <ScreenShareOff color="#FFF" size={20} />
          ) : (
            <ScreenShare color="#FFF" size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.8}>
          <PhoneOff color="#FFF" size={20} />
        </TouchableOpacity>
      </View>

      {/* ─── CHAT PANEL ─── */}
      {chatOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.chatPanel}
        >
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Chat</Text>
            <TouchableOpacity onPress={() => setChatOpen(false)} hitSlop={12}>
              <X color="#FFF" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {messages.length === 0 && (
              <Text style={styles.chatEmpty}>No messages yet. Chat here during the session.</Text>
            )}
            {messages.map((m) => (
              <View key={m.id} style={[styles.bubbleRow, m.mine && { justifyContent: 'flex-end' }]}>
                <View style={[styles.bubble, m.mine ? [styles.bubbleMine, { backgroundColor: accent }] : styles.bubbleOther]}>
                  {!m.mine && <Text style={styles.bubbleName}>{otherPersonName || 'Participant'}</Text>}
                  <Text style={styles.bubbleText}>{m.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message..."
              placeholderTextColor="#64748B"
              style={styles.chatInput}
              onSubmitEditing={sendChat}
              returnKeyType="send"
              maxLength={500}
            />
            <TouchableOpacity
              onPress={sendChat}
              style={[styles.sendBtn, { backgroundColor: accent }, !draft.trim() && { opacity: 0.4 }]}
              disabled={!draft.trim()}
            >
              <Send color="#FFF" size={18} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  half: {
    flex: 1,
    backgroundColor: '#111827',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  avatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  waitingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  stopShareBtn: {
    marginTop: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  stopShareText: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },
  nameLabelPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  nameLabelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  micOffBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconnectingBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reconnectingText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },

  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: { color: '#FFF', fontSize: 10.5, fontWeight: '800' },

  emojiBar: {
    position: 'absolute',
    bottom: 82,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emojiBtn: { paddingHorizontal: 7, paddingVertical: 4 },

  controlsBar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  controlBtnActive: { backgroundColor: 'rgba(37, 99, 235, 0.95)' },
  minimizeBtn: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipCol: {
    position: 'absolute',
    right: 12,
    gap: 8,
  },
  pipTile: {
    width: 84,
    height: 112,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipAvatar: { width: 44, height: 44, borderRadius: 22 },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  endCallBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // chat
  chatPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  chatTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  chatEmpty: { color: '#64748B', fontSize: 12.5, textAlign: 'center', marginTop: 20 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#2563EB' },
  bubbleOther: { backgroundColor: '#1E293B' },
  bubbleName: { color: '#94A3B8', fontSize: 10.5, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: '#FFF', fontSize: 14 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
});

// ─── ROUTE ENTRY POINT (thin trigger — CallSessionProvider ke pattern jaisa) ───
export default function VideoSessionScreen({ route, navigation }: any) {
  const {
    serverUrl,
    token,
    otherPersonName,
    otherPersonAvatarUrl,
    userAvatarUrl,
    bookingId,
  } = route?.params || {};
  const { startCall } = useCallSession();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (!token) {
      Alert.alert('Error', 'Session token is missing.');
      navigation.goBack();
      return;
    }

    startCall({
      serverUrl,
      token,
      roomType: 'one_to_one',
      otherPersonName,
      otherPersonAvatarUrl,
      userAvatarUrl,
      bookingId,
    });
    navigation.goBack();
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#38BDF8" />
      <Text style={styles.loadingText}>Connecting to session...</Text>
    </View>
  );
}