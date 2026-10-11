import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Alert,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  LiveKitRoom,
  useRoomContext,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useConnectionState,
  AudioSession,
  registerGlobals,
  VideoTrack,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';
import { useCallSession } from './CallSessionProvider';
import { checkClassRoomAccess } from '../../payments/paymentService';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  ScreenShare,
  Smile,
  X,
  Send,
  Hand,
  Users,
  Clock,
  Check,
  Sparkles,
  UserCheck,
  Monitor,
  ChevronDown,
  FileText,
} from 'lucide-react-native';

registerGlobals();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUSBAR_SAFE_HEIGHT =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 14 : 14;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const IN_ROOM_AVATARS = [
  { id: 'm1', label: 'Boy 1', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundColor=ffd5dc' },
  { id: 'f1', label: 'Girl 1', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Zoe&backgroundColor=ffdfbf' },
  { id: 'm2', label: 'Boy 2', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Felix&backgroundColor=c0aede' },
  { id: 'f2', label: 'Girl 2', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Lily&backgroundColor=d1d4f9' },
  { id: 'm3', label: 'Boy 3', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Milo&backgroundColor=b6e3f4' },
  { id: 'f3', label: 'Girl 3', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Chloe&backgroundColor=ffd5dc' },
  { id: 'm4', label: 'Boy 4', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Jack&backgroundColor=ffdfbf' },
  { id: 'f4', label: 'Girl 4', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Sophie&backgroundColor=c0aede' },
  { id: 'm7', label: 'Classic Boy', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Sam&backgroundColor=b6e3f4' },
  { id: 'f7', label: 'Classic Girl', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Jessica&backgroundColor=ffd5dc' },
];

const DEFAULT_FALLBACK_AVATAR = IN_ROOM_AVATARS[0].url;
const QUICK_EMOJI_LIST = ['👏', '👍', '❤️', '🔥', '😂', '😮'];

interface ChatAttachment {
  type: 'image' | 'video' | 'file' | 'audio';
  url: string;
  name?: string;
  mimeType?: string;
  durationMs?: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  isLocal: boolean;
  createdAt?: any;
  time?: string;
  attachment?: ChatAttachment;
}

interface QueueUser {
  id: string;
  name: string;
  timestamp: number;
}

interface PermissionRequest {
  senderId: string;
  senderName: string;
  mediaType: 'audio' | 'video';
}

const CircularAudioWaves = ({ isActive }: { isActive: boolean }) => {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (isActive) {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulse1, {
              toValue: 1.35,
              duration: 1000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulse1, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(350),
            Animated.timing(pulse2, {
              toValue: 1.5,
              duration: 1000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulse2, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse1.setValue(1);
      pulse2.setValue(1);
      opacity.setValue(0);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.wavePulseRing,
          { transform: [{ scale: pulse1 }], opacity },
        ]}
      />
      <Animated.View
        style={[
          styles.wavePulseRing,
          { transform: [{ scale: pulse2 }], opacity },
        ]}
      />
    </>
  );
};

// ─── TILE COMPONENT ───
const ClassTrackTile = ({
  participant,
  trackReference,
  handRaisedUsers,
  reactions,
  totalCount,
  liveLocalAvatar,
  columns,
  compact,
}: {
  participant: any;
  trackReference?: any;
  handRaisedUsers: Record<string, boolean>;
  reactions: Record<string, string>;
  totalCount: number;
  liveLocalAvatar?: string;
  columns?: number;
  compact?: boolean;
}) => {
  const { width: tileWinWidth } = useWindowDimensions();
  const isLocal = Boolean(participant?.isLocal);
  const identity = participant?.identity || 'User';

  const isHandRaised = Boolean(handRaisedUsers[identity]);
  const activeReaction = reactions[identity];
  const isSpeaking = Boolean(participant?.isSpeaking && participant?.isMicrophoneEnabled);

  let avatarUrl = isLocal && liveLocalAvatar ? liveLocalAvatar : DEFAULT_FALLBACK_AVATAR;
  try {
    if (!isLocal && participant?.metadata) {
      const meta = JSON.parse(participant.metadata);
      if (meta?.avatarUrl) avatarUrl = meta.avatarUrl;
    }
  } catch (e) {}

  const hasActiveVideo =
    trackReference &&
    trackReference.publication &&
    trackReference.publication.isSubscribed !== false &&
    trackReference.publication.track &&
    !trackReference.publication.isMuted;

  const handBounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHandRaised) {
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(handBounceAnim, {
            toValue: -8,
            duration: 280,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(handBounceAnim, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      bounce.start();
      return () => bounce.stop();
    } else {
      handBounceAnim.setValue(0);
    }
  }, [isHandRaised]);

  const miniEmojiScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (activeReaction) {
      Animated.sequence([
        Animated.spring(miniEmojiScale, { toValue: 1.2, friction: 4, useNativeDriver: true }),
        Animated.spring(miniEmojiScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    } else {
      miniEmojiScale.setValue(0);
    }
  }, [activeReaction]);

  const cols = columns || (totalCount <= 1 ? 1 : tileWinWidth >= 768 ? 3 : 2);
  const gutter = 12 * cols;
  const dynamicTileSize = compact
    ? { width: 96, height: 128 }
    : totalCount <= 1
    ? { width: Math.min(tileWinWidth * 0.45, 220), maxWidth: Math.min(tileWinWidth * 0.45, 220) }
    : { flex: 1 / cols, maxWidth: (tileWinWidth - gutter) / cols };

  return (
    <View
      style={[
        styles.participantTile,
        dynamicTileSize,
        compact && styles.compactParticipantTile,
        isSpeaking && styles.speakingBorderGlow,
        isHandRaised && styles.handRaisedBorderGlow,
      ]}
    >
      {hasActiveVideo ? (
        <VideoTrack
          trackRef={trackReference}
          style={styles.videoStream}
          mirror={isLocal && trackReference.source === Track.Source.Camera}
          zOrder={0}
        />
      ) : (
        <View style={styles.avatarPlaceholderContainer}>
          <CircularAudioWaves isActive={isSpeaking} />
          <View
            style={[
              styles.avatarGlowBorder,
              isSpeaking && styles.avatarSpeakingGlow,
            ]}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>
        </View>
      )}

      {isHandRaised && (
        <Animated.View
          style={[
            styles.handRaiseBadge,
            { transform: [{ translateY: handBounceAnim }] },
          ]}
        >
          <Text style={styles.handRaiseText}>✋ Hand Raised</Text>
        </Animated.View>
      )}

      {activeReaction && (
        <Animated.View
          style={[
            styles.cornerReactionBadge,
            { transform: [{ scale: miniEmojiScale }] },
          ]}
        >
          <Text style={styles.cornerReactionEmoji}>{activeReaction}</Text>
        </Animated.View>
      )}

      <View style={styles.tileOverlay}>
        <Text style={styles.tileName} numberOfLines={1}>
          {isLocal ? `${identity} (You)` : identity}
        </Text>
      </View>
    </View>
  );
};

// ─── MAIN VIEW ───
export const ClassRoomView = ({ safeExit, onMinimize, roomTitle, isHost, roomId, userAvatarUrl }: any) => {
  const room = useRoomContext();
  // 📱 Responsive dims — useWindowDimensions re-renders on rotation / split
  // screen / tablet multi-window resize, unlike the static Dimensions.get()
  // value computed once at module load.
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTablet = winWidth >= 768;
  const chatCardWidth = isTablet ? Math.min(winWidth * 0.5, 520) : winWidth;
  const chatCardHeight = isTablet ? Math.min(winHeight * 0.75, 640) : winHeight * 0.72;
  const connectionState = useConnectionState();
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  
  const remoteParticipants = useRemoteParticipants();

  const participantList = useMemo(() => {
    const list: any[] = [];
    if (localParticipant) {
      list.push(localParticipant);
    }
    remoteParticipants.forEach((p) => {
      if (!list.some((item) => item.identity === p.identity)) {
        list.push(p);
      }
    });
    return list;
  }, [localParticipant, remoteParticipants]);

  const currentUser = auth().currentUser;

  const [currentAvatar, setCurrentAvatar] = useState(userAvatarUrl || DEFAULT_FALLBACK_AVATAR);
  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);

  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isEmojiVisible, setIsEmojiVisible] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // 🎯 FIX: naya message aane par list auto-scroll ho ke neeche (latest tak)
  // aaye — pehle isce koi ref nahi thi, isliye naya message list ke bottom
  // me chala jaata tha bina visible hue jab tak user khud scroll na kare.
  const chatListRef = useRef<FlatList<any>>(null);
  const [messageInput, setMessageInput] = useState('');
  const [queueList, setQueueList] = useState<QueueUser[]>([]);

  const [handRaisedUsers, setHandRaisedUsers] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});

  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: string; emoji: string; startX: number }[]
  >([]);

  const [incomingRequest, setIncomingRequest] = useState<PermissionRequest | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emojiWaveAnims = useRef(QUICK_EMOJI_LIST.map(() => new Animated.Value(0))).current;

  // Track Subscriptions
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      onlySubscribed: false,
    }
  );

  // REMOTE SCREEN SHARE TRACK SELECTOR (FIXED & STABLE)
  // NOTE: pehle sirf `isMuted` check ho raha tha, isliye agar track abhi
  // subscribe nahi hua ya publication.track hi nahi aaya, to bhi ye truthy
  // maan liya jaata tha aur VideoTrack ko invalid reference milta tha.
  // Ab hum explicitly check karte hain ki track subscribed hai aur uska
  // actual `track` object bhi maujood hai, tabhi use render karenge.
  const remoteScreenShareTrack = useMemo(() => {
    return tracks.find(
      (t) =>
        t.source === Track.Source.ScreenShare &&
        !t.participant.isLocal &&
        t.publication &&
        t.publication.isSubscribed !== false &&
        !!t.publication.track &&
        !t.publication.isMuted
    );
  }, [tracks]);

  // LOCAL SCREEN SHARE TRACK REFERENCE (for local preview + keeping the
  // capture pipeline actively bound to a renderer)
  const localScreenShareTrackRef = useMemo(() => {
    return tracks.find(
      (t) => t.source === Track.Source.ScreenShare && t.participant.isLocal
    );
  }, [tracks]);

  const isLocalSharing = isScreenShareEnabled;

  // 🔍 DEBUG LISTENERS — Screen share publish/subscribe lifecycle
  // Ye sirf console.log karte hain, taaki aap Metro/adb logcat me dekh sakein
  // ki track actually PUBLISH ho raha hai ya nahi, aur REMOTE side par
  // SUBSCRIBE ho raha hai ya nahi. Agar "Track published" to dikhe lekin
  // remote device pe "Track subscribed" kabhi na aaye, to issue backend
  // token permissions (canPublishSources) ya server routing me hai, is
  // .tsx file me nahi.
  useEffect(() => {
    if (!room) return;

    const onPublished = (publication: any, participant: any) => {
      if (publication?.source === Track.Source.ScreenShare) {
        console.log(
          '[ScreenShare] Track PUBLISHED by',
          participant?.identity,
          publication?.trackSid
        );
      }
    };
    const onUnpublished = (publication: any, participant: any) => {
      if (publication?.source === Track.Source.ScreenShare) {
        console.log(
          '[ScreenShare] Track UNPUBLISHED by',
          participant?.identity
        );
      }
    };
    const onSubscribed = (track: any, publication: any, participant: any) => {
      if (publication?.source === Track.Source.ScreenShare) {
        console.log(
          '[ScreenShare] Track SUBSCRIBED from',
          participant?.identity
        );
      }
    };
    const onSubscriptionFailed = (trackSid: string, participant: any) => {
      console.log(
        '[ScreenShare] Subscription FAILED for',
        trackSid,
        'from',
        participant?.identity
      );
    };

    room.on(RoomEvent.TrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.TrackUnpublished, onUnpublished);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onSubscriptionFailed);

    return () => {
      room.off(RoomEvent.TrackPublished, onPublished);
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.TrackUnpublished, onUnpublished);
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onSubscriptionFailed);
    };
  }, [room]);

  const myIdentity =
    localParticipant?.identity ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'User';

  useEffect(() => {
    if (isEmojiVisible) {
      emojiWaveAnims.forEach((anim) => anim.setValue(0));
      const staggered = emojiWaveAnims.map((anim, index) => {
        return Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 60,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        });
      });
      Animated.stagger(50, staggered).start();
    }
  }, [isEmojiVisible]);

  // Firestore Chat Sync
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = firestore()
      .collection('voice_rooms')
      .doc(roomId)
      .collection('class_messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snapshot) => {
          if (snapshot) {
            const list: ChatMessage[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              list.push({
                id: doc.id,
                sender: data.sender || 'User',
                senderId: data.senderId || '',
                text: data.text || '',
                isLocal: false,
                time: data.time || '',
                createdAt: data.createdAt,
              });
            });
            setChatMessages((prev) => {
              const firestoreIds = new Set(list.map((m) => m.id));
              const nonFirestore = prev.filter((m) => !firestoreIds.has(m.id));
              return [...list, ...nonFirestore];
            });
          }
        },
        (err) => console.log('Chat fetch error:', err)
      );

    return () => unsubscribe();
  }, [roomId]);

  // Keyboard shifting is now handled declaratively by KeyboardAvoidingView
  // around the chat modal, so the old manual Animated shift effect (jo
  // pehle card ko keyboard khulte hi upar/off-screen dhakel deta tha) hata
  // diya gaya hai.

  // Sync Avatar Metadata
  useEffect(() => {
    let isCancelled = false;
    const syncMetadata = async () => {
      try {
        const isConnected = String(connectionState).toLowerCase() === 'connected';
        if (!isCancelled && isConnected && localParticipant && currentAvatar) {
          await localParticipant.setMetadata(JSON.stringify({ avatarUrl: currentAvatar }));
        }
      } catch (e) {}
    };

    syncMetadata();
    return () => {
      isCancelled = true;
    };
  }, [connectionState, localParticipant, currentAvatar]);

  const handleUpdateAvatar = async (newUrl: string) => {
    setCurrentAvatar(newUrl);
    setIsAvatarPickerVisible(false);
    if (localParticipant && String(connectionState).toLowerCase() === 'connected') {
      try {
        await localParticipant.setMetadata(JSON.stringify({ avatarUrl: newUrl }));
      } catch (e) {}
    }
  };

  const sendDataPacket = async (payloadObj: any) => {
    if (!localParticipant || String(connectionState).toLowerCase() !== 'connected') return;
    try {
      const str = JSON.stringify(payloadObj);
      const data = textEncoder.encode(str);
      await localParticipant.publishData(data, { reliable: true });
    } catch (e) {}
  };

  const triggerBottomToTopFloatingEmoji = (emoji: string) => {
    const id = Math.random().toString();
    const startX = Math.random() * (SCREEN_WIDTH - 80) + 30;
    setFloatingEmojis((prev) => [...prev, { id, emoji, startX }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  };

  // 📡 LiveKit Data Packet Listener
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decodedStr = textDecoder.decode(payload);
        const senderIdentity = participant?.identity || 'User';

        let data: any = null;
        try {
          data = JSON.parse(decodedStr);
        } catch {
          data = { type: 'CHAT', text: decodedStr };
        }

        const packetType = String(data.type || '').toUpperCase();

        // 🎯 FIX: DUPLICATE MESSAGES
        // Pehle CHAT type packets yahan bhi setChatMessages() se seedhe add
        // ho jaate the (random id ke sath), AUR wahi message thodi der baad
        // Firestore ke onSnapshot listener se bhi add ho jaata tha (doc.id
        // ke sath) — ye dono IDs kabhi match nahi karte the, isliye dedupe
        // logic dono ko alag-alag maan kar rakh leta tha → har message
        // remote participants ko DO BAAR dikhta tha.
        //
        // Firestore listener akela hi kaafi hai (sabko, sender included,
        // real-time deliver karta hai), isliye CHAT ke liye ye data-packet
        // path yahan se hata diya gaya hai. RAISE_HAND / REACTION jaise
        // baaki data packets bilkul pehle jaise hi chalte rahenge.
        if (
          packetType === 'RAISE_HAND' ||
          packetType === 'HAND_RAISE' ||
          data.handRaised !== undefined ||
          data.isRaised !== undefined
        ) {
          const isRaised = data.isRaised ?? data.handRaised ?? true;
          setHandRaisedUsers((prev) => ({
            ...prev,
            [senderIdentity]: isRaised,
          }));
        }
        else if (packetType === 'REACTION' || data.emoji) {
          const incomingEmoji = data.emoji || '👍';
          setReactions((prev) => ({
            ...prev,
            [senderIdentity]: incomingEmoji,
          }));
          triggerBottomToTopFloatingEmoji(incomingEmoji);

          setTimeout(() => {
            setReactions((prev) => {
              const updated = { ...prev };
              delete updated[senderIdentity];
              return updated;
            });
          }, 3800);
        }
        else if (packetType === 'QUEUE_JOIN') {
          setQueueList((prev) => {
            if (prev.some((item) => item.id === senderIdentity)) return prev;
            const updated = [
              ...prev,
              { id: senderIdentity, name: data.name || senderIdentity, timestamp: data.timestamp },
            ];
            return updated.sort((a, b) => a.timestamp - b.timestamp);
          });
        } else if (packetType === 'QUEUE_LEAVE') {
          setQueueList((prev) => prev.filter((item) => item.id !== senderIdentity));
        }
        else if (packetType === 'REQUEST_MEDIA_PERMISSION') {
          if (isHost) {
            setIncomingRequest({
              senderId: senderIdentity,
              senderName: data.senderName || senderIdentity,
              mediaType: data.mediaType,
            });
          }
        } else if (packetType === 'GRANT_MEDIA_PERMISSION') {
          if (data.targetId === localParticipant?.identity) {
            handleGrantedPermission(data.mediaType, data.duration);
          }
        }
      } catch (err) {
        console.error('Error decoding data packet:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isHost, localParticipant]);

  const handleGrantedPermission = async (
    mediaType: 'audio' | 'video',
    duration: number,
  ) => {
    if (!localParticipant) return;

    if (mediaType === 'audio') {
      await localParticipant.setMicrophoneEnabled(true);
    } else if (mediaType === 'video') {
      await localParticipant.setCameraEnabled(true);
    }

    Alert.alert(
      'Access Approved 🔊',
      `Admin has granted permission for ${mediaType.toUpperCase()} for ${duration}s.`,
    );

    setTimeRemaining(duration);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (mediaType === 'audio') {
            localParticipant.setMicrophoneEnabled(false);
          }
          if (mediaType === 'video') {
            localParticipant.setCameraEnabled(false);
          }

          Alert.alert('Time Finished', `Your allocated ${mediaType} time is finished.`);
          return null;
        }

        return prev - 1;
      });
    }, 1000);
  };

  const toggleMic = async () => {
    if (!localParticipant) return;
    if (String(connectionState).toLowerCase() !== 'connected') {
      Alert.alert('Please wait', 'Connecting to room engine...');
      return;
    }

    if (isHost) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } else {
      if (isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(null);
      } else {
        await sendDataPacket({
          type: 'REQUEST_MEDIA_PERMISSION',
          senderName: localParticipant.identity,
          mediaType: 'audio',
        });
        Alert.alert('Request Sent ✋', 'Microphone request has been sent to Admin/Host.');
      }
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    if (String(connectionState).toLowerCase() !== 'connected') {
      Alert.alert('Please wait', 'Connecting to room engine...');
      return;
    }

    if (isHost) {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } else {
      if (isCameraEnabled) {
        await localParticipant.setCameraEnabled(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(null);
      } else {
        await sendDataPacket({
          type: 'REQUEST_MEDIA_PERMISSION',
          senderName: localParticipant.identity,
          mediaType: 'video',
        });
        Alert.alert('Request Sent ✋', 'Camera request has been sent to Admin/Host.');
      }
    }
  };

  const approvePermissionRequest = async () => {
    if (!incomingRequest) return;
    await sendDataPacket({
      type: 'GRANT_MEDIA_PERMISSION',
      targetId: incomingRequest.senderId,
      mediaType: incomingRequest.mediaType,
      duration: selectedDuration,
    });
    setIncomingRequest(null);
  };

  // SAFE SCREEN SHARE TOGGLE
  const toggleScreenShare = async () => {
    if (!localParticipant || String(connectionState).toLowerCase() !== 'connected') {
      Alert.alert('Please wait', 'Connecting to room engine...');
      return;
    }

    try {
      const targetState = !isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(targetState);
    } catch (err: any) {
      console.error('Screen share error:', err);
      Alert.alert('Screen Share Error', err?.message || 'Could not toggle screen share.');
    }
  };

  const isInQueue = queueList.some((item) => item.id === myIdentity);

  const toggleQueueStatus = async () => {
    const timestamp = Date.now();
    if (isInQueue) {
      setQueueList((prev) => prev.filter((item) => item.id !== myIdentity));
      await sendDataPacket({ type: 'QUEUE_LEAVE' });
    } else {
      setQueueList((prev) => {
        const updated = [
          ...prev,
          { id: myIdentity, name: myIdentity, timestamp },
        ];
        return updated.sort((a, b) => a.timestamp - b.timestamp);
      });
      await sendDataPacket({ type: 'QUEUE_JOIN', name: myIdentity, timestamp });
    }
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!text) return;
    if (!roomId) return;
    setMessageInput('');

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // NOTE: pehle yahan sendDataPacket({ type: 'CHAT', ... }) bhi call hota
    // tha, jo Firestore write ke sath MILKAR har message ko remote
    // participants ko DO BAAR deliver karta tha (duplicate bug — fix upar
    // handleDataReceived me bhi dekho). Firestore ka onSnapshot listener
    // akela hi sabko real-time me message deliver kar deta hai, isliye ye
    // data-packet call yahan se hata diya gaya hai.

    try {
      await firestore()
        .collection('voice_rooms')
        .doc(roomId)
        .collection('class_messages')
        .add({
          sender: myIdentity,
          senderId: currentUser?.uid || localParticipant?.identity || myIdentity,
          text,
          time: formattedTime,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      console.log('Error saving message to Firestore:', e);
    }
  };

  // Photo / video / file sharing in chat has been removed (text, emoji and voice notes only).

  const toggleHandRaise = async () => {
    const currentStatus = !handRaisedUsers[myIdentity];
    setHandRaisedUsers((prev) => ({
      ...prev,
      [myIdentity]: currentStatus,
    }));
    await sendDataPacket({ type: 'RAISE_HAND', isRaised: currentStatus });
    setIsEmojiVisible(false);
  };

  const sendEmojiReaction = async (emoji: string) => {
    setReactions((prev) => ({
      ...prev,
      [myIdentity]: emoji,
    }));
    triggerBottomToTopFloatingEmoji(emoji);

    setTimeout(() => {
      setReactions((prev) => {
        const updated = { ...prev };
        delete updated[myIdentity];
        return updated;
      });
    }, 3800);

    await sendDataPacket({ type: 'REACTION', emoji });
    setIsEmojiVisible(false);
  };

  const handleLeaveCall = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);

      // 🔒 HOST-ONLY ROOM END — pehle sirf client se aaye `isHost` boolean
      // pe bharosa karke room delete kar dete the. Problem: agar kisi
      // wajah se `isHost: true` galat pass ho jaaye (ya koi aur admin
      // baad me isi room me join kare), to unka "leave" button poore
      // room ko sabke liye end kar deta — jo NAHI hona chahiye.
      //
      // Ab delete karne se PEHLE Firestore se room ka FRESH doc padhte
      // hain aur uska `createdBy` current logged-in user ke uid se
      // match karte hain. Sirf ASLI creator (jisne room banaya tha)
      // ka delete chalega — koi bhi baad me join karne wala admin/user
      // sirf khud room LEAVE karega, baaki sabka call chalta rahega.
      if (roomId) {
        try {
          const roomSnap = await firestore().collection('voice_rooms').doc(roomId).get();
          const roomData = roomSnap.data();
          const currentUid = auth().currentUser?.uid;
          const isActualCreator = !!roomData && !!currentUid && roomData.createdBy === currentUid;

          if (isActualCreator) {
            await firestore().collection('voice_rooms').doc(roomId).delete();
          }
        } catch (verifyErr) {
          console.log('Room-owner verify failed, skipping delete (leave-only):', verifyErr);
        }
      }

      // 🖤 WHITE-SCREEN-ON-LEAVE FIX: pehle yahan `room.disconnect()`
      // MANUALLY call hota tha, aur uske turant baad `safeExit()` (jo
      // `activeCall` ko null karke `<LiveKitRoom connect={canConnect}>`
      // ko unmount karta hai) bhi apni taraf se disconnect trigger karta
      // hai — matlab DO baar disconnect ek hi room pe, ek dusre ke bahut
      // paas. Iss race condition me native media pipeline (Android pe
      // camera/audio surface) kabhi-kabhi ek inconsistent state me phas
      // jaata hai — JS me koi error nahi dikhta, bas screen white reh
      // jaati hai, aur sirf pura Metro reload native module ko dobara
      // init karke fix karta hai.
      //
      // Fix: pehle camera/mic tracks ko explicitly OFF karte hain (isse
      // native camera surface turant release ho jaata hai, safely), aur
      // manual `room.disconnect()` HATA diya — teardown ab sirf ek hi
      // jagah se hota hai: `safeExit()` ke through jab `canConnect` false
      // hota hai aur `<LiveKitRoom>` khud cleanly unmount/disconnect
      // karta hai.
      try {
        if (localParticipant) {
          await localParticipant.setCameraEnabled(false).catch(() => {});
          await localParticipant.setMicrophoneEnabled(false).catch(() => {});

          // ⏱️ TIMING FIX: `setCameraEnabled(false)` ka promise resolve
          // hote hi native camera SurfaceView TURANT release nahi hota —
          // Android pe actual surface teardown 1-2 frame BAAD hota hai.
          // Agar hum turant `safeExit()` (unmount) kar dein, wo residual
          // frame kabhi-kabhi screen pe white overlay ki tarah reh jaata
          // hai. Isi wajah se ye bug sirf HOST me dikh raha tha — sirf
          // host hi bina kisi restriction ke seedha camera/mic ON kar
          // sakta hai (participants ke liye permission-request flow hai,
          // jo test me aksar grant nahi hota), isliye HOST ka camera
          // aksar actually chalu hota tha aur uska hi leftover surface
          // bachta tha.
          //
          // Chhota sa delay dekar native side ko surface properly
          // release karne ka time dete hain.
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      } catch (mediaErr) {
        console.log('Error disabling camera/mic before leave:', mediaErr);
      }
    } catch (e) {
      console.log('Error leaving class:', e);
    } finally {
      safeExit();
    }
  };

  const isMyHandRaised = !!handRaisedUsers[myIdentity];
  const isSharingActive = !!remoteScreenShareTrack || isLocalSharing;

  // ─── ⬅️ MINIMIZE (do NOT disconnect) ───
  // Ye call ko band nahi karta — sirf is screen ko background me bhej ke
  // navigation stack ki pichli screen pe le jaata hai, taaki user app ke
  // andar kahin aur (ya device ka koi aur app, share-sheet/gallery kholkar)
  // ja sake aur wapas aa sake.
  //
  // ⚠️ IMPORTANT: React Navigation me `goBack()` is component (ClassRoomView
  // → LiveKitRoom) ko UNMOUNT kar deta hai, jisse room actually disconnect ho
  // jaayega — bilkul "safeExit/handleLeaveCall" jaisa hi, sirf firestore room
  // delete nahi hota. Taaki call SACHME background me chalta rahe jab user
  // dusri screen/app par ho, LiveKitRoom instance ko is screen ke bahar,
  // ek top-level "CallProvider" (App.tsx ke navigator ke upar) me rakhna
  // hoga, aur ye screen sirf us provider ke UI ko render kare. Wo restructure
  // is file ke bahar hai — bata dena to wo Provider bhi bana deta hoon.
  const handleMinimize = async () => {
    // 🖤 MINIMIZE WHITE-SCREEN FIX: minimize karte waqt `ClassRoomView`
    // (jisme camera tile hota hai) unmount ho jaata hai, lekin
    // `LiveKitRoom` khud MOUNTED rehta hai (isliye ye camera SurfaceView
    // ko band NAHI karta apne aap). Android pe camera preview ek native
    // SurfaceView hai jo normal RN Views ke UPAR ek alag hardware layer
    // me render hota hai — parent View transparent ho tab bhi ye leftover
    // surface poori screen pe SOLID WHITE overlay ki tarah dikh jaata hai.
    //
    // Fix: minimize se PEHLE camera ko explicitly OFF kar dete hain (mic
    // ON rehne dete hain taaki audio call chalti rahe) — isse wo native
    // camera surface hi nahi banta jo white overlay ka source tha. Jab
    // user wapas expand karega, wo chahe to camera phir se manually ON
    // kar sakta hai (jaisa class/study room me normally hota hai).
    try {
      if (localParticipant) {
        await localParticipant.setCameraEnabled(false).catch(() => {});

        // ⏱️ TIMING FIX: camera disable ka promise resolve hote hi
        // native SurfaceView turant release nahi hota (1-2 frame lagte
        // hain Android pe). Turant minimize kar dene se wo residual
        // frame white overlay ki tarah reh jaata tha — khaaskar HOST
        // ke liye, jiska camera bina kisi restriction ke seedha ON ho
        // sakta hai. Thoda delay dekar surface ko properly release hone
        // ka time dete hain.
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } catch (e) {
      console.log('Error disabling camera on minimize:', e);
    }

    if (typeof onMinimize === 'function') {
      onMinimize();
    } else {
      safeExit();
    }
  };

  return (
    <ImageBackground
      // 🎨 New Class Room theme: dark navy with a subtle repeating
      // school-doodle pattern (apple, pencil, ruler, calendar, book, cap),
      // matching the target design. `resizeMode="repeat"` tiles the small
      // pattern image edge-to-edge instead of stretching one big photo.
      source={require('../../../assets/classroom-bg.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >

      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: STATUSBAR_SAFE_HEIGHT }]}>
          <TouchableOpacity
            style={styles.minimizeBtn}
            onPress={handleMinimize}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronDown color="#F8FAFC" size={22} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>
              {roomTitle || 'Official Class Room'}
            </Text>
            <View style={styles.statusRowBadge}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.headerSubtitleText}>
                {participantList.length} Joined • Live HD Class
              </Text>
            </View>
          </View>

          {timeRemaining !== null && (
            <View style={styles.timerContainer}>
              <Clock color="#10B981" size={16} />
              <Text style={styles.timerText}>{timeRemaining}s</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.headerAvatarButton}
            onPress={() => setIsAvatarPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: currentAvatar }} style={styles.headerAvatarImg} resizeMode="contain" />
            <View style={styles.avatarEditPill}>
              <Sparkles size={9} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 📺 SCREEN SHARE — now fills the ENTIRE remaining screen area
            (mobile & tablet) instead of a small fixed-height box, with a
            slim horizontal thumbnail strip of participants underneath. */}
        {isSharingActive ? (
          <View style={styles.shareFullContainer}>
            {remoteScreenShareTrack ? (
              // REMOTE PARTICIPANT SCREEN SHARE
              <View
                style={[
                  styles.screenShareHeroBox,
                  { borderRadius: isTablet ? 20 : 0 },
                ]}
              >
                <VideoTrack
                  trackRef={{
                    participant: remoteScreenShareTrack.participant,
                    source: Track.Source.ScreenShare,
                    publication: remoteScreenShareTrack.publication,
                  }}
                  style={styles.screenShareHeroVideo}
                  zOrder={1}
                  objectFit="contain"
                />
                <View style={styles.screenShareBadge}>
                  <ScreenShare size={14} color="#FFF" />
                  <Text style={styles.screenShareBadgeText}>
                    {remoteScreenShareTrack.participant?.identity || 'Presentation'}'s Screen
                  </Text>
                </View>
              </View>
            ) : (
              // LOCAL PARTICIPANT SCREEN SHARE UI
              <View
                style={[
                  styles.screenShareHeroBoxLocal,
                  { borderRadius: isTablet ? 20 : 0 },
                ]}
              >
                {localScreenShareTrackRef ? (
                  <VideoTrack
                    trackRef={localScreenShareTrackRef}
                    style={styles.localScreenSharePreview}
                    objectFit="contain"
                    zOrder={0}
                  />
                ) : null}
                <View style={styles.localSharingContent}>
                  <View style={styles.sharingPulseIcon}>
                    <Monitor size={isTablet ? 46 : 36} color="#38BDF8" />
                  </View>
                  <Text style={styles.localSharingTitle}>You are sharing your screen</Text>
                  <Text style={styles.localSharingSub}>
                    All members in this classroom can see your device screen.
                  </Text>
                  <TouchableOpacity
                    style={styles.stopSharingBtn}
                    onPress={toggleScreenShare}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.stopSharingBtnText}>Stop Screen Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Slim thumbnail strip so faces are still visible while the
                shared screen takes up the full viewport. */}
            <FlatList
              data={participantList}
              keyExtractor={(item) => item.identity}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbStripList}
              contentContainerStyle={styles.thumbStripContent}
              renderItem={({ item }) => {
                const trackRef = tracks.find(
                  (t) => t.participant?.identity === item.identity && t.source === Track.Source.Camera,
                );
                return (
                  <View style={styles.thumbTileWrapper}>
                    <ClassTrackTile
                      participant={item}
                      trackReference={trackRef}
                      handRaisedUsers={handRaisedUsers}
                      reactions={reactions}
                      totalCount={2}
                      liveLocalAvatar={currentAvatar}
                      compact
                    />
                  </View>
                );
              }}
            />
          </View>
        ) : (
          /* ─── PARTICIPANTS GRID (no active share) ─── */
          <View style={styles.mainContent}>
            <FlatList
              data={participantList}
              keyExtractor={(item) => item.identity}
              key={`${participantList.length <= 1 ? 'single' : 'grid'}-${isTablet ? 'tablet' : 'phone'}`}
              numColumns={participantList.length <= 1 ? 1 : isTablet ? 3 : 2}
              contentContainerStyle={[
                styles.gridContainer,
                participantList.length <= 1 && styles.singleGridContainer,
              ]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const trackRef = tracks.find(
                  (t) => (t.participant?.identity === item.identity) && t.source === Track.Source.Camera,
                );
                return (
                  <ClassTrackTile
                    participant={item}
                    trackReference={trackRef}
                    handRaisedUsers={handRaisedUsers}
                    reactions={reactions}
                    totalCount={participantList.length}
                    liveLocalAvatar={currentAvatar}
                  />
                );
              }}
            />
          </View>
        )}

        {/* FLOATING EMOJIS */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {floatingEmojis.map((item) => (
            <FloatingEmojiItem key={item.id} emoji={item.emoji} startX={item.startX} />
          ))}
        </View>

        {/* ─── CONTROLS BAR ─── */}
        <View style={styles.controlsWrapper}>
          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={[
                styles.controlBtn,
                isMicrophoneEnabled ? styles.btnActive3D : styles.btnMuted3D,
              ]}
              onPress={toggleMic}
              activeOpacity={0.75}
            >
              {isMicrophoneEnabled ? (
                <Mic color="#FFF" size={21} />
              ) : (
                <MicOff color="#94A3B8" size={21} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                isCameraEnabled ? styles.btnActive3D : styles.btnMuted3D,
              ]}
              onPress={toggleCamera}
              activeOpacity={0.75}
            >
              {isCameraEnabled ? (
                <VideoIcon color="#FFF" size={21} />
              ) : (
                <VideoOff color="#94A3B8" size={21} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                isScreenShareEnabled ? styles.btnActive3D : styles.btnMuted3D,
              ]}
              onPress={toggleScreenShare}
              activeOpacity={0.75}
            >
              <ScreenShare color={isScreenShareEnabled ? "#FFF" : "#94A3B8"} size={21} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                queueList.length > 0 ? styles.btnActive3D : styles.btnMuted3D,
              ]}
              onPress={() => setIsQueueVisible(true)}
              activeOpacity={0.75}
            >
              <Users color={queueList.length > 0 ? "#FFF" : "#94A3B8"} size={21} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isEmojiVisible ? styles.btnActive3D : styles.btnMuted3D]}
              onPress={() => setIsEmojiVisible((prev) => !prev)}
              activeOpacity={0.75}
            >
              <Smile color={isEmojiVisible ? "#FFF" : "#94A3B8"} size={21} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                isChatVisible ? styles.btnActive3D : styles.btnMuted3D,
              ]}
              onPress={() => setIsChatVisible(true)}
              activeOpacity={0.75}
            >
              <MessageSquare color={isChatVisible ? "#FFF" : "#94A3B8"} size={21} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.endCallBtn3D]}
              onPress={handleLeaveCall}
              activeOpacity={0.75}
            >
              <PhoneOff color="#FFF" size={21} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── EMOJI PICKER MODAL ─── */}
        <Modal visible={isEmojiVisible} animationType="fade" transparent onRequestClose={() => setIsEmojiVisible(false)}>
          <View style={styles.emojiModalBackdrop}>
            <TouchableWithoutFeedback onPress={() => setIsEmojiVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View style={[styles.floatingEmojiCard, { maxWidth: winWidth - 24 }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiCardScrollContent}
              >
                <TouchableOpacity
                  style={[
                    styles.compactRaiseHandBtn,
                    isTablet && styles.compactRaiseHandBtnTablet,
                    isMyHandRaised ? styles.compactRaiseHandActive : styles.compactRaiseHandInactive,
                  ]}
                  onPress={toggleHandRaise}
                  activeOpacity={0.8}
                >
                  <Hand color={isMyHandRaised ? '#10B981' : '#FFF'} size={isTablet ? 20 : 18} />
                  <Text style={styles.compactRaiseHandText}>
                    {isMyHandRaised ? 'Lower ✋' : 'Raise Hand ✋'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.emojiRowDivider} />

                <View style={styles.emojiWaveRow}>
                  {QUICK_EMOJI_LIST.map((emoji, index) => {
                    const animVal = emojiWaveAnims[index] || new Animated.Value(1);
                    return (
                      <Animated.View
                        key={emoji}
                        style={{
                          transform: [
                            {
                              translateY: animVal.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [20, -10, 0],
                              }),
                            },
                            {
                              scale: animVal.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.3, 1],
                              }),
                            },
                          ],
                          opacity: animVal,
                        }}
                      >
                        <TouchableOpacity
                          style={[styles.singleEmojiCircle, isTablet && styles.singleEmojiCircleTablet]}
                          onPress={() => sendEmojiReaction(emoji)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.emojiText, isTablet && styles.emojiTextTablet]}>{emoji}</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ─── 🔔 HOST APPROVAL POP-UP ─── */}
        <Modal visible={!!incomingRequest} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.approvalCard}>
              <Text style={styles.approvalTitle}>Permission Request</Text>
              <Text style={styles.approvalSub}>
                <Text style={{ fontWeight: 'bold', color: '#FFF' }}>
                  {incomingRequest?.senderName}
                </Text>{' '}
                has requested permission to turn on their{' '}
                <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{incomingRequest?.mediaType?.toUpperCase()}</Text>.
              </Text>

              <Text style={styles.timeLabel}>Select Duration:</Text>
              <View style={styles.timeOptionsRow}>
                {[15, 30, 60, 120].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.timeChip,
                      selectedDuration === duration && styles.timeChipSelected,
                    ]}
                    onPress={() => setSelectedDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        selectedDuration === duration && styles.timeChipTextSelected,
                      ]}
                    >
                      {duration}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.approvalActionRow}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => setIncomingRequest(null)}
                >
                  <X color="#FFF" size={18} />
                  <Text style={styles.actionBtnText}>Deny</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={approvePermissionRequest}
                >
                  <Check color="#FFF" size={18} />
                  <Text style={styles.actionBtnText}>Allow</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── CHAT MODAL ───
            Fix: pehle Animated.View ko manually translateY diya jaa raha
            tha jo keyboard khulte hi card ko screen ke top se bahar dhakel
            deta tha. Ab KeyboardAvoidingView use karte hain jo card ko
            hamesha visible area ke andar hi rakhta hai — mobile aur tablet
            dono par, chahe portrait ho ya landscape. */}
        <Modal visible={isChatVisible} animationType="fade" transparent onRequestClose={() => setIsChatVisible(false)}>
          <KeyboardAvoidingView
            style={styles.chatCenterBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsChatVisible(false); }}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View
              style={[
                styles.chatCenterCard,
                { width: chatCardWidth, height: chatCardHeight },
              ]}
            >
              <View style={styles.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.chatHeaderCircleIcon}>
                    <MessageSquare size={16} color="#38BDF8" />
                  </View>
                  <Text style={styles.sheetTitle}>In-Class Discussion</Text>
                </View>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsChatVisible(false); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X color="#94A3B8" size={20} />
                </TouchableOpacity>
              </View>

              <FlatList
                ref={chatListRef}
                data={chatMessages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => chatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe =
                    (currentUser?.uid && item.senderId === currentUser.uid) ||
                    (localParticipant?.identity && item.senderId === localParticipant.identity) ||
                    item.sender === myIdentity ||
                    (localParticipant?.identity && item.sender === localParticipant.identity);

                  return (
                    <View
                      style={[
                        styles.chatRowWrapper,
                        isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
                      ]}
                    >
                      <View
                        style={[
                          styles.chatBubble,
                          { maxWidth: isTablet ? '65%' : '80%' },
                          isMe ? styles.chatBubbleLocal : styles.chatBubbleRemote,
                        ]}
                      >
                        <Text style={[styles.chatSender, isMe ? { color: '#93C5FD' } : { color: '#38BDF8' }]}>
                          {isMe ? 'You' : item.sender}
                        </Text>


                        {!!item.text && <Text style={styles.chatText}>{item.text}</Text>}
                        <Text style={styles.chatTime}>{item.time}</Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyChatBox}>
                    <Text style={styles.emptyChatText}>No messages yet. Say hi!</Text>
                  </View>
                }
              />

                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#64748B"
                    value={messageInput}
                    onChangeText={setMessageInput}
                    onSubmitEditing={() => handleSendMessage()}
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.sendBtn, messageInput.trim().length === 0 && { opacity: 0.45 }]}
                    onPress={() => handleSendMessage()}
                    disabled={messageInput.trim().length === 0}
                  >
                    <Send color="#FFF" size={18} />
                  </TouchableOpacity>
                </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ─── IN-ROOM AVATAR PICKER MODAL ─── */}
        <Modal
          visible={isAvatarPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsAvatarPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setIsAvatarPickerVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View style={styles.avatarModalCard}>
              <View style={styles.avatarModalHeader}>
                <Text style={styles.avatarModalTitle}>Change In-Class Avatar</Text>
                <TouchableOpacity onPress={() => setIsAvatarPickerVisible(false)}>
                  <X color="#94A3B8" size={20} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.avatarGridContainer}>
                {IN_ROOM_AVATARS.map((item) => {
                  const isSelected = currentAvatar === item.url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.avatarPickTile,
                        isSelected && styles.avatarPickTileActive,
                      ]}
                      onPress={() => handleUpdateAvatar(item.url)}
                    >
                      <Image source={{ uri: item.url }} style={styles.avatarVectorImg} resizeMode="contain" />
                      <Text style={[styles.avatarLabel, isSelected && { color: '#0284C7' }]}>
                        {item.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.avatarCheckmarkBadge}>
                          <UserCheck size={10} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ─── SESSION QUEUE MODAL ─── */}
        <Modal
          visible={isQueueVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIsQueueVisible(false)}
        >
          <SafeAreaView style={styles.queueContainer}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>Session queue</Text>
              <TouchableOpacity
                style={styles.closeBtnTouchable}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                onPress={() => setIsQueueVisible(false)}
                activeOpacity={0.7}
              >
                <X color="#FFFFFF" size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.queueActionBtn}
              onPress={toggleQueueStatus}
            >
              <Text style={styles.queueActionBtnText}>
                {isInQueue ? 'Leave queue' : 'Join queue'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.zoneText}>CLASSROOM ZONE</Text>

            <FlatList
              data={queueList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.queueListContainer}
              renderItem={({ item, index }) => (
                <View style={styles.queueCard}>
                  <View style={styles.queueIndexBadge}>
                    <Text style={styles.queueIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.queueNameText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyQueueBox}>
                  <Text style={styles.emptyQueueText}>
                    No students in queue currently.
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

// Animated Floating Bottom-to-Top Emoji Component
const FloatingEmojiItem = ({ emoji, startX }: { emoji: string; startX: number }) => {
  const floatAnim = useRef(new Animated.Value(SCREEN_HEIGHT - 120)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(floatAnim, {
        toValue: SCREEN_HEIGHT * 0.25,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 2200, useNativeDriver: true }),
      ]),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 2600,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.floatingEmojiWrapper,
        {
          left: startX,
          opacity: opacityAnim,
          transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.floatingEmojiText}>{emoji}</Text>
    </Animated.View>
  );
};

// ─── 🫧 FLOATING MINIMIZED CALL BUBBLE ───
// Ye component <LiveKitRoom> ke ANDAR render hota hai (ClassRoomView ki jagah)
// jab call minimize hoti hai. Isliye room connection kabhi disconnect nahi
// hota — sirf UI ek chhoti draggable bubble me badal jaata hai. Tap karne se
// wapas full call screen khul jaati hai, aur bubble ko drag karke kahin bhi
// screen par move kiya ja sakta hai.
export const FloatingCallBubble = ({ roomTitle, userAvatarUrl, onExpand, onEndCall }: any) => {
  const { isMicrophoneEnabled } = useLocalParticipant();
  const connectionState = useConnectionState();

  const pan = useRef(
    new Animated.ValueXY({ x: SCREEN_WIDTH - 84, y: SCREEN_HEIGHT * 0.55 })
  ).current;

  // Tap vs drag ko differentiate karne ke liye total movement track karte hain
  const totalMovement = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        totalMovement.current = 0;
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        totalMovement.current += Math.abs(gesture.dx) + Math.abs(gesture.dy);
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gesture);
      },
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        // Agar bubble ko bahut kam move kiya gaya, to ye ek TAP tha — expand karo.
        if (totalMovement.current < 6) {
          onExpand();
          return;
        }

        // Warna, bubble ko screen ke sabse paas wale edge (left/right) pe
        // snap kar do, taaki wo kisi content ko block na kare.
        const currentX = (pan.x as any)._value;
        const snapToRight = currentX > SCREEN_WIDTH / 2 - 60;
        Animated.spring(pan, {
          toValue: {
            x: snapToRight ? SCREEN_WIDTH - 84 : 12,
            y: Math.max(
              40,
              Math.min((pan.y as any)._value, SCREEN_HEIGHT - 160)
            ),
          },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        bubbleStyles.container,
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={bubbleStyles.avatarWrap}>
        <Image
          source={{ uri: userAvatarUrl || DEFAULT_FALLBACK_AVATAR }}
          style={bubbleStyles.avatar}
        />
        {!isMicrophoneEnabled && (
          <View style={bubbleStyles.micOffBadge}>
            <MicOff size={10} color="#FFF" />
          </View>
        )}
        {connectionState !== 'connected' && (
          <View style={bubbleStyles.reconnectDot} />
        )}
      </View>
      <TouchableOpacity
        style={bubbleStyles.endCallMiniBtn}
        onPress={onEndCall}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <PhoneOff size={11} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const bubbleStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 64,
    height: 64,
    zIndex: 9999,
    elevation: 20,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  micOffBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  reconnectDot: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FBBF24',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  endCallMiniBtn: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
});

// ─── 🌍 ROUTE ENTRY POINT (thin trigger) ───
// PEHLE: ye component khud <LiveKitRoom> ko mount karta tha, isliye jab bhi
// navigator se ye screen hatti thi (goBack, ya kisi aur screen pe navigate),
// LiveKitRoom UNMOUNT ho jaata tha aur call disconnect ho jaati thi. Isi
// wajah se "minimize" ek chhote bubble tak hi limited tha, poori app me
// navigate nahi kar sakte the.
//
// AB: actual call (LiveKitRoom + UI + floating bubble) ab CallSessionProvider
// (App.tsx me NavigationContainer ke sath sibling) ke andar rehta hai — jo
// navigator ke UPAR ek overlay ki tarah render hota hai. Ye route sirf
// provider ko "yahan call start karo" bolta hai aur turant khud navigator se
// hat jaata hai (goBack). Overlay ab navigator ke upar dikhta rehta hai chahe
// user app me kahin bhi navigate kare.
//
// ⚠️ ZAROORI: Isko kaam karne ke liye `App.tsx` ko <CallSessionProvider> se
// wrap karna hoga — dekho CallSessionProvider.tsx file + neeche di gayi
// integration instructions.
export default function ClassRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl } =
    route?.params || {};
  const { startCall } = useCallSession();
  const hasStartedRef = useRef(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const proceed = async () => {
      if (!token) {
        Alert.alert('Error', 'Room token is missing.');
        navigation.goBack();
        return;
      }

      // 👑 ADMIN BYPASS — agar current logged-in user ki email `admins`
      // collection me hai (jaisa Firestore console me admin1/admin2 docs
      // dikh rahe hain), to subscription/entitlement check SKIP kar do aur
      // seedha join karwa do. Ye sirf email-match pe hai (admin/host ke
      // liye) — normal students ke liye neeche wala normal subscription
      // gate hi chalega.
      //
      // NOTE: Agar ye admin-check hi kisi wajah se fail ho jaaye (network
      // waghera), to hum FAIL-SAFE default lete hain — yaani normal
      // subscription check pe hi fall back karte hain, taaki koi galti se
      // bina check ke andar na aa jaaye.
      let isAdminUser = false;
      try {
        const currentEmail = auth().currentUser?.email?.toLowerCase().trim();
        if (currentEmail) {
          const adminSnap = await firestore()
            .collection('admins')
            .where('email', '==', currentEmail)
            .limit(1)
            .get();
          isAdminUser = !adminSnap.empty;
        }
      } catch (adminCheckErr) {
        console.log('Admin check failed, falling back to normal flow:', adminCheckErr);
        isAdminUser = false;
      }

      if (isAdminUser) {
        setCheckingAccess(false);
        startCall({ serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl });
        navigation.goBack();
        return;
      }

      // 🔒 ENTITLEMENT GATE — Class Room paid hai, isliye join karne se
      // pehle server se confirm karte hain ki subscription active hai ya
      // nahi. Ye check hamesha SERVER (Cloud Function) se hota hai, kabhi
      // bhi frontend me `user.isPaid` jaisi local value trust nahi karte —
      // warna koi bhi ise bypass kar sakta hai.
      //
      // NOTE: Ye gate sirf Class Room pe lagaya hai. Study Room free hai,
      // usme ye gate nahi lagega.
      try {
        const { hasAccess } = await checkClassRoomAccess();

        if (!hasAccess) {
          // Subscription active nahi hai — Subscribe karne ke liye bhejo.
          // `returnTo` ke through, payment successful hone ke baad
          // SubscriptionScreen seedha isी Class Room me wapas bhej dega.
          navigation.replace('ProgramFlowScreen', { mode: 'audio' });
          return;
        }
      } catch (err) {
        console.error('checkClassRoomAccess error:', err);
        Alert.alert(
          'Error',
          'Access check nahi ho paaya. Please check your internet aur dobara try karo.'
        );
        navigation.goBack();
        return;
      }

      setCheckingAccess(false);
      startCall({ serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl });
      // Is route ko turant navigator se hata do — call ab provider ke overlay
      // me chal rahi hai, is screen ki ab zaroorat nahi.
      navigation.goBack();
    };

    proceed();
  }, []);

  // Ye screen khud kabhi visible nahi hoti (turant pop ho jaati hai), isliye
  // render kuch nahi karta — bas ek chhota loading fallback safety ke liye.
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.loadingText}>
        {checkingAccess ? 'Checking access...' : 'Joining Class Room...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
    backgroundColor: '#070D18',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    // 🎨 Transparent so the new classroom-bg.png doodle pattern (set on the
    // <ImageBackground> that wraps this) is actually visible — an opaque
    // color here would hide it completely. This is still safe against the
    // old transparency-bleed issue: CallSessionProvider's own wrapping
    // <View> already paints a solid '#070D18' behind everything while the
    // call is full-screen (see CallSessionProvider.tsx), so nothing from
    // the screen underneath can show through.
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070D18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  minimizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  roomTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  statusRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  headerSubtitleText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  headerAvatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1.8,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarEditPill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#2563EB',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginRight: 10,
  },
  timerText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  singleGridContainer: {
    alignItems: 'center',
  },

  // Wraps the full-screen share video + the thumbnail strip underneath it.
  shareFullContainer: {
    flex: 1,
    width: '100%',
  },
  screenShareHeroBox: {
    flex: 1,
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 0,
    position: 'relative',
    zIndex: 10,
  },
  screenShareHeroBoxLocal: {
    flex: 1,
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#0F172A',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbStripList: {
    flexGrow: 0,
    maxHeight: 138,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  thumbStripContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  thumbTileWrapper: {
    marginRight: 4,
  },
  localScreenSharePreview: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
  },
  localSharingContent: {
    alignItems: 'center',
  },
  sharingPulseIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  localSharingTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  localSharingSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  stopSharingBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stopSharingBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  screenShareHeroVideo: {
    width: '100%',
    height: '100%',
  },
  screenShareBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  screenShareBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  participantTile: {
    flex: 0.5,
    maxWidth: (SCREEN_WIDTH - 36) / 2,
    height: 154,
    margin: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.65)',
  },
  singleParticipantTile: {
    width: 175,
    maxWidth: 175,
    flex: 0,
  },
  compactParticipantTile: {
    height: 128,
    borderRadius: 16,
    margin: 5,
  },
  speakingBorderGlow: {
    borderColor: '#10B981',
  },
  handRaisedBorderGlow: {
    borderColor: '#F59E0B',
  },
  videoStream: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  wavePulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#10B981',
  },
  avatarGlowBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  avatarSpeakingGlow: {
    borderColor: '#10B981',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  tileOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  tileName: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  handRaiseBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 15,
  },
  handRaiseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  cornerReactionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 25,
  },
  cornerReactionEmoji: {
    fontSize: 22,
  },

  floatingEmojiWrapper: {
    position: 'absolute',
    zIndex: 99,
  },
  floatingEmojiText: {
    fontSize: 36,
  },

  controlsWrapper: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 8,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.8)',
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnActive3D: {
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  btnMuted3D: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  endCallBtn3D: {
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },

  emojiModalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 88,
  },
  floatingEmojiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  compactRaiseHandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  compactRaiseHandBtnTablet: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  compactRaiseHandInactive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  compactRaiseHandActive: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  compactRaiseHandText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emojiRowDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
    marginHorizontal: 10,
  },
  emojiCardScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  emojiWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  singleEmojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  singleEmojiCircleTablet: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  emojiText: {
    fontSize: 18,
  },
  emojiTextTablet: {
    fontSize: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
  },
  approvalCard: {
    width: '85%',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 22,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  approvalSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 10,
  },
  timeOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: '600',
  },
  timeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  approvalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    gap: 6,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 14,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  queueContainer: {
    flex: 1,
    backgroundColor: '#121316',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    zIndex: 10,
  },
  queueTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtnTouchable: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#1C1D22',
  },
  queueActionBtn: {
    backgroundColor: '#26282E',
    borderWidth: 1,
    borderColor: '#383B42',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  queueActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9FA5',
    letterSpacing: 1,
    marginBottom: 16,
  },
  queueListContainer: {
    paddingBottom: 20,
  },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D22',
    borderWidth: 1,
    borderColor: '#2A2C33',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  queueIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D3038',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  queueIndexText: {
    color: '#9E9FA5',
    fontSize: 13,
    fontWeight: '700',
  },
  queueNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  emptyQueueBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyQueueText: {
    color: '#64748B',
    fontSize: 14,
  },

  chatCenterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
  sheetHeader: {
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
  sheetTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  chatList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  chatRowWrapper: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 4,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  chatBubbleLocal: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  chatBubbleRemote: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chatSender: {
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  chatText: {
    fontSize: 13.5,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  chatTime: {
    fontSize: 9,
    color: '#CBD5E1',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  emptyChatBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    color: '#64748B',
    fontSize: 13,
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
  chatInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#FFF',
    fontSize: 13.5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },

  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#0F172A',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimeText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  recordingCancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  attachSheetCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 18,
    marginBottom: 40,
  },
  attachSheetTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  attachOption: {
    alignItems: 'center',
    gap: 6,
  },
  attachOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachOptionLabel: {
    color: '#CBD5E1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  attachCancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  attachCancelText: {
    color: '#94A3B8',
    fontSize: 13.5,
    fontWeight: '700',
  },

  attachmentImagePreview: {
    width: 190,
    height: 140,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#1E293B',
  },
  attachmentVideoPreview: {
    width: 190,
    height: 110,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  attachmentFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,23,42,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: 200,
  },
  attachmentFileLabel: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  attachmentAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,23,42,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 6,
  },
  attachmentAudioPlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarModalCard: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    maxHeight: 460,
  },
  avatarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarModalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  avatarGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatarPickTile: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    position: 'relative',
  },
  avatarPickTileActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  avatarVectorImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
  },
  avatarCheckmarkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#38BDF8',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});