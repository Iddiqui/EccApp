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
} from 'lucide-react-native';

registerGlobals();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUSBAR_SAFE_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 14 : 14;
const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👏', '😂', '💡', '🎉', '👋', '💯', '✨'];
const DEFAULT_FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundColor=ffd5dc';

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
  totalCount 
}: any) => {
  const isLocal = participant?.isLocal;
  const isMicOn = Boolean(participant?.isMicrophoneEnabled);
  const isSpeaking = Boolean(participant?.isSpeaking && isMicOn);
  
  let avatarUrl = fallbackAvatarUrl || DEFAULT_FALLBACK_AVATAR;
  let participantHand = isHandRaised;

  try {
    if (participant?.metadata) {
      const meta = JSON.parse(participant.metadata);
      if (meta?.avatarUrl) avatarUrl = meta.avatarUrl;
      if (typeof meta?.isHandRaised === 'boolean') participantHand = meta.isHandRaised;
    }
  } catch (e) {}

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

      {/* Mic Status */}
      <View style={[styles.tileMicBadge, isMicOn ? styles.tileMicActive : styles.tileMicMuted]}>
        {isMicOn ? <Mic size={11} color="#FFF" /> : <MicOff size={11} color="#FFF" />}
      </View>

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
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="contain" />
        </View>

        <MicWaveBars isActive={isMicOn && (isSpeaking || isLocal)} />
      </View>

      <Text style={styles.nameText} numberOfLines={1}>
        {isLocal ? `${participant?.identity} (You)` : participant?.identity}
      </Text>
    </View>
  );
};

// ─── MAIN ROOM VIEW ───
const StudyRoomView = ({ safeExit, roomTitle, isHost, roomId, userAvatarUrl }: any) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Chat & Call States
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // 🚀 Native Smooth Keyboard Animation Driver (Zero Lag)
  const keyboardShiftAnim = useRef(new Animated.Value(0)).current;

  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth().currentUser;
  const currentUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const shiftDistance = -(e.endCoordinates.height - 75);
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

  // Sync LiveKit Metadata when Connected
  useEffect(() => {
    let isCancelled = false;
    const syncMetadata = async () => {
      try {
        if (!isCancelled && String(connectionState).toLowerCase() === 'connected' && localParticipant && userAvatarUrl) {
          await localParticipant.setMetadata(JSON.stringify({ 
            avatarUrl: userAvatarUrl,
            isHandRaised: isHandRaised,
          }));
        }
      } catch (e) {}
    };

    syncMetadata();
    return () => {
      isCancelled = true;
    };
  }, [connectionState, localParticipant, userAvatarUrl, isHandRaised]);

  // Firestore Realtime Chat
  useEffect(() => {
    if (!roomId) return;
    const unsub = firestore()
      .collection('voice_rooms')
      .doc(roomId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snap) => {
        if (snap) {
          const list: any[] = [];
          snap.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          setMessages(list);
          if (!showChatModal && list.length > 0) {
            setUnreadCount((c) => c + 1);
          }
        }
      });

    return () => unsub();
  }, [roomId, showChatModal]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || !roomId) return;
    setChatInputText('');

    try {
      await firestore().collection('voice_rooms').doc(roomId).collection('messages').add({
        text,
        senderId: currentUser?.uid || 'guest',
        senderName: currentUserName,
        avatarUrl: userAvatarUrl || DEFAULT_FALLBACK_AVATAR,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.log('Error sending room message:', e);
    }
  };

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (e) {
      console.log('Mic toggle error:', e);
    }
  };

  const toggleHandRaise = () => {
    setIsHandRaised(prev => !prev);
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
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{roomTitle || 'Study Room'}</Text>
            <View style={styles.statusRow}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.participantCount}>
                {participants.length} Active • Audio HD Live
              </Text>
            </View>
          </View>

          <View style={styles.headerAvatarBadge}>
            <Image source={{ uri: userAvatarUrl || DEFAULT_FALLBACK_AVATAR }} style={styles.headerAvatarImg} resizeMode="contain" />
          </View>
        </View>

        {/* ─── PARTICIPANTS LIST ─── */}
        <View style={styles.mainContent}>
          <FlatList
            data={participants}
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
                fallbackAvatarUrl={item.isLocal ? userAvatarUrl : DEFAULT_FALLBACK_AVATAR}
                isHandRaised={item.isLocal ? isHandRaised : false}
                totalCount={participants.length}
              />
            )}
          />
        </View>

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

        {/* ─── 💬 CENTER CHAT MODAL ─── */}
        <Modal visible={showChatModal} transparent animationType="fade" onRequestClose={() => setShowChatModal(false)}>
          <View style={styles.chatCenterBackdrop}>
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
              { transform: [{ translateY: keyboardShiftAnim }] }
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
                        <Image source={{ uri: item.avatarUrl || DEFAULT_FALLBACK_AVATAR }} style={styles.chatAvatarThumb} resizeMode="contain" />
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
                        <Image source={{ uri: item.avatarUrl || userAvatarUrl || DEFAULT_FALLBACK_AVATAR }} style={styles.chatAvatarThumb} resizeMode="contain" />
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
export default function StudyRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId, userAvatarUrl } = route?.params || {};
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    let isMounted = true;
    // 🔑 Reset connection state as soon as we get new params. Without this,
    // if this screen instance gets reused for a different room (e.g. Study
    // Room -> Class Room) before it fully unmounts, the old room's UI stays
    // visible for a frame because `canConnect` was still `true` from before.
    setCanConnect(false);

    const prepare = async () => {
      try {
        if (!token) {
          navigation.goBack();
          return;
        }

        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        // Make sure any previous session (from a room we just left) is fully
        // torn down before starting a new one, otherwise LiveKit can end up
        // holding on to the old room's native audio/connection state.
        await AudioSession.stopAudioSession().catch(() => {});
        await AudioSession.startAudioSession();
        if (isMounted) setCanConnect(true);
      } catch (err) {
        console.error('Audio Session error:', err);
      }
    };
    prepare();
    return () => {
      isMounted = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [token, roomId]);

  if (!canConnect || !token) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Connecting to HD Audio Room...</Text>
      </View>
    );
  }

  return (
    <View style={styles.flexOne}>
      <LiveKitRoom
        // 🔑 THE ACTUAL FIX: key this on roomId+token so React fully
        // unmounts the previous LiveKitRoom (and StudyRoomView) and mounts
        // a brand new one whenever the room changes. Without a key, React
        // reuses the same LiveKitRoom instance across prop updates, and
        // @livekit/react-native does NOT automatically reconnect/reset its
        // internal room + participants state just because `token`/
        // `serverUrl` props changed. That stale state is exactly what was
        // showing Study Room's call inside Class Room until you navigated
        // away and back (which forced a fresh mount).
        key={`${roomId || 'room'}-${token}`}
        serverUrl={serverUrl}
        token={token}
        connect={canConnect}
        audio={true}
        video={false}
      >
        <StudyRoomView
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

// ─── STYLES ───
const styles = StyleSheet.create({
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