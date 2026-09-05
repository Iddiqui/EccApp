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

interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  isLocal: boolean;
  createdAt?: any;
  time?: string;
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
}: {
  participant: any;
  trackReference?: any;
  handRaisedUsers: Record<string, boolean>;
  reactions: Record<string, string>;
  totalCount: number;
  liveLocalAvatar?: string;
}) => {
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

  return (
    <View
      style={[
        styles.participantTile,
        totalCount <= 1 && styles.singleParticipantTile,
        isSpeaking && styles.speakingBorderGlow,
        isHandRaised && styles.handRaisedBorderGlow,
      ]}
    >
      {hasActiveVideo ? (
        <VideoTrack
          trackRef={trackReference}
          style={styles.videoStream}
          mirror={isLocal && trackReference.source === Track.Source.Camera}
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
const ClassRoomView = ({ safeExit, roomTitle, isHost, roomId, userAvatarUrl }: any) => {
  const room = useRoomContext();
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

  const keyboardShiftAnim = useRef(new Animated.Value(0)).current;
  const emojiWaveAnims = useRef(QUICK_EMOJI_LIST.map(() => new Animated.Value(0))).current;

  // Track Subscriptions: Ensure both camera & screenshare tracks are tracked
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Find active screen share track
  const activeScreenShare = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track && !t.publication?.isMuted
  );

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

  // Keyboard Animation
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const shiftDistance = -(e.endCoordinates.height - 70);
      Animated.timing(keyboardShiftAnim, {
        toValue: shiftDistance,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardShiftAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sync Avatar
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

  // 📡 Universal Data Decoder (Handles Web Client, Mobile App, & Standard LiveKit Packets)
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

        // 1. CHAT MESSAGE
        if (packetType === 'CHAT' || data.message) {
          const incomingText = data.text || data.message;
          const formattedTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setChatMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: senderIdentity,
              senderId: participant?.sid || senderIdentity,
              text: incomingText,
              isLocal: false,
              time: formattedTime,
            },
          ]);
        }
        // 2. HAND RAISE (Universal match for RAISE_HAND, raise_hand, hand_raise, handRaised)
        else if (
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
        // 3. EMOJI REACTION (Universal match for REACTION, reaction, or direct emoji string)
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
        // 4. QUEUE
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
        // 5. PERMISSION REQUEST (ADMIN APPROVAL)
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

  const toggleScreenShare = async () => {
    if (localParticipant && String(connectionState).toLowerCase() === 'connected') {
      try {
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
      } catch (err) {
        console.error('Screen share error:', err);
      }
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
    if (!messageInput.trim() || !roomId) return;
    const text = messageInput.trim();
    setMessageInput('');

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    sendDataPacket({
      type: 'CHAT',
      text,
      time: formattedTime,
    });

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
      if (isHost && roomId) {
        await firestore().collection('voice_rooms').doc(roomId).delete();
      }
      if (room) await room.disconnect();
    } catch (e) {
      console.log('Error leaving class:', e);
    } finally {
      safeExit();
    }
  };

  const isMyHandRaised = !!handRaisedUsers[myIdentity];

  return (
    <ImageBackground
     source={require('../../../assets/room.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: STATUSBAR_SAFE_HEIGHT }]}>
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

        {/* 📺 SCREEN SHARE HERO FRAME (Auto-Renders on Any Active Screen Share) */}
        {Boolean(activeScreenShare) && (
          <View style={styles.screenShareHeroBox}>
            <VideoTrack
              trackRef={activeScreenShare!}
              style={styles.screenShareHeroVideo}
            />
            <View style={styles.screenShareBadge}>
              <ScreenShare size={14} color="#FFF" />
              <Text style={styles.screenShareBadgeText}>
                {activeScreenShare?.participant?.identity || 'Presentation'}'s Screen
              </Text>
            </View>
          </View>
        )}

        {/* ─── PARTICIPANTS GRID ─── */}
        <View style={styles.mainContent}>
          <FlatList
            data={participantList}
            keyExtractor={(item) => item.identity}
            key={participantList.length <= 1 ? 'single' : 'grid'}
            numColumns={participantList.length <= 1 ? 1 : 2}
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

        {/* FLOATING EMOJIS */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {floatingEmojis.map((item) => (
            <FloatingEmojiItem key={item.id} emoji={item.emoji} startX={item.startX} />
          ))}
        </View>

        {/* ─── 3D CONTROLS BAR ─── */}
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

            <View style={styles.floatingEmojiCard}>
              <TouchableOpacity
                style={[
                  styles.compactRaiseHandBtn,
                  isMyHandRaised ? styles.compactRaiseHandActive : styles.compactRaiseHandInactive,
                ]}
                onPress={toggleHandRaise}
                activeOpacity={0.8}
              >
                <Hand color={isMyHandRaised ? '#10B981' : '#FFF'} size={18} />
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
                        style={styles.singleEmojiCircle}
                        onPress={() => sendEmojiReaction(emoji)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
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

        {/* ─── CHAT MODAL ─── */}
        <Modal visible={isChatVisible} animationType="fade" transparent onRequestClose={() => setIsChatVisible(false)}>
          <View style={styles.chatCenterBackdrop}>
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsChatVisible(false); }}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
              styles.chatCenterCard,
              { transform: [{ translateY: keyboardShiftAnim }] }
            ]}>
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
                data={chatMessages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                showsVerticalScrollIndicator={false}
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
                          isMe ? styles.chatBubbleLocal : styles.chatBubbleRemote,
                        ]}
                      >
                        <Text style={[styles.chatSender, isMe ? { color: '#93C5FD' } : { color: '#38BDF8' }]}>
                          {isMe ? 'You' : item.sender}
                        </Text>
                        <Text style={styles.chatText}>{item.text}</Text>
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
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                  <Send color="#FFF" size={18} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
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

// 🎈 Animated Floating Bottom-to-Top Emoji Component
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

export default function ClassRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl } =
    route?.params || {};
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const prepare = async () => {
      try {
        if (!token) {
          Alert.alert('Error', 'Room token is missing.');
          navigation.goBack();
          return;
        }

        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ]);
        }

        await AudioSession.startAudioSession();
        if (AudioSession.configureAudio) {
          await AudioSession.configureAudio({
            android: {
              preferredOutputList: ['speaker'],
            },
            forceSpeakerOutput: true,
            speakerphone: true,
          } as any);
        }

        if (isMounted) setCanConnect(true);
      } catch (err) {
        console.error('Permissions or AudioSession error:', err);
      }
    };

    prepare();
    return () => {
      isMounted = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [token]);

  if (!canConnect || !token) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Joining Class Room...</Text>
      </View>
    );
  }

  return (
    <View style={styles.flexOne}>
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={canConnect}
        audio={false}
        video={false}
      >
        <ClassRoomView
          safeExit={() => navigation.goBack()}
          roomTitle={roomTitle}
          isHost={isHost}
          roomId={roomId}
          userAvatarUrl={userAvatarUrl}
        />
      </LiveKitRoom>
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
    backgroundColor: 'rgba(7, 13, 24, 0.85)',
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

  screenShareHeroBox: {
    width: SCREEN_WIDTH - 24,
    height: 220,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#38BDF8',
    position: 'relative',
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
  emojiText: {
    fontSize: 18,
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