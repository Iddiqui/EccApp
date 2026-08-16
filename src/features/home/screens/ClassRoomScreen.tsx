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
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  LiveKitRoom,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
  useTracks,
  AudioSession,
  registerGlobals,
  VideoTrack,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
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
} from 'lucide-react-native';

registerGlobals();

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isLocal: boolean;
  time: string;
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

// Single Track / Tile Renderer
const ClassTrackTile = ({
  trackReference,
  handRaisedUsers,
  reactions,
}: {
  trackReference: any;
  handRaisedUsers: Record<string, boolean>;
  reactions: Record<string, string>;
}) => {
  const { participant, publication } = trackReference;
  const isLocal = participant?.isLocal;
  const identity = participant?.identity || 'User';

  const isHandRaised = handRaisedUsers[identity];
  const activeReaction = reactions[identity];

  return (
    <View style={styles.participantTile}>
      {publication && publication.isSubscribed !== false && publication.track ? (
        <VideoTrack
          trackRef={trackReference}
          style={styles.videoStream}
          mirror={isLocal && trackReference.source === Track.Source.Camera}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{identity[0].toUpperCase()}</Text>
        </View>
      )}

      {/* ✋ Hand Raised Badge */}
      {isHandRaised && (
        <View style={styles.handRaiseBadge}>
          <Text style={styles.handRaiseText}>✋ Hand Raised</Text>
        </View>
      )}

      {/* 😃 Emoji Reaction Badge */}
      {activeReaction && (
        <View style={styles.reactionBadge}>
          <Text style={styles.reactionText}>{activeReaction}</Text>
        </View>
      )}

      <View style={styles.tileOverlay}>
        <Text style={styles.tileName} numberOfLines={1}>
          {isLocal ? `${identity} (You)` : identity}
        </Text>
      </View>
    </View>
  );
};

const ClassRoomView = ({ safeExit, roomTitle, isHost, roomId }: any) => {
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } =
    useLocalParticipant();
  const participants = useParticipants();

  // Modals
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isEmojiVisible, setIsEmojiVisible] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);

  // States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [queueList, setQueueList] = useState<QueueUser[]>([]);

  // Hand Raise & Reactions State
  const [handRaisedUsers, setHandRaisedUsers] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});

  // 🔒 Permission & Time Limit States
  const [incomingRequest, setIncomingRequest] = useState<PermissionRequest | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30); // Default 30 sec
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });

  const sendDataPacket = async (payloadObj: any) => {
    if (!localParticipant) return;
    const str = JSON.stringify(payloadObj);
    const data = textEncoder.encode(str);
    await localParticipant.publishData(data, { reliable: true });
  };

  // 📡 Listen to Real-time Data Packets
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decodedStr = textDecoder.decode(payload);
        const data = JSON.parse(decodedStr);
        const senderIdentity = participant?.identity || 'User';

        if (data.type === 'CHAT') {
          setChatMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: senderIdentity,
              text: data.text,
              isLocal: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else if (data.type === 'RAISE_HAND') {
          setHandRaisedUsers((prev) => ({
            ...prev,
            [senderIdentity]: data.isRaised,
          }));
        } else if (data.type === 'REACTION') {
          setReactions((prev) => ({
            ...prev,
            [senderIdentity]: data.emoji,
          }));

          setTimeout(() => {
            setReactions((prev) => {
              const updated = { ...prev };
              delete updated[senderIdentity];
              return updated;
            });
          }, 4000);
        } else if (data.type === 'QUEUE_JOIN') {
          setQueueList((prev) => {
            if (prev.some((item) => item.id === senderIdentity)) return prev;
            const updated = [
              ...prev,
              { id: senderIdentity, name: data.name || senderIdentity, timestamp: data.timestamp },
            ];
            return updated.sort((a, b) => a.timestamp - b.timestamp);
          });
        } else if (data.type === 'QUEUE_LEAVE') {
          setQueueList((prev) => prev.filter((item) => item.id !== senderIdentity));
        }
        // 🔒 REQUEST MEDIA PERMISSION (Host Side)
        else if (data.type === 'REQUEST_MEDIA_PERMISSION' && isHost) {
          setIncomingRequest({
            senderId: senderIdentity,
            senderName: data.senderName || senderIdentity,
            mediaType: data.mediaType,
          });
        }
        // 🔓 GRANT MEDIA PERMISSION (User Side)
        else if (data.type === 'GRANT_MEDIA_PERMISSION') {
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

  // Handle granted permission on student side
  const handleGrantedPermission = async (mediaType: 'audio' | 'video', duration: number) => {
    if (!localParticipant) return;

    if (mediaType === 'audio') {
      await localParticipant.setMicrophoneEnabled(true);
    } else if (mediaType === 'video') {
      await localParticipant.setCameraEnabled(true);
    }

    Alert.alert('Permission Granted', `Host has unmuted your ${mediaType} for ${duration} seconds.`);

    setTimeRemaining(duration);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          // Auto Mute Logic
          if (mediaType === 'audio') localParticipant.setMicrophoneEnabled(false);
          if (mediaType === 'video') localParticipant.setCameraEnabled(false);
          Alert.alert('Time Up', `Your allocated ${mediaType} time is completed.`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 🎙 Controls with Permission Check
  const toggleMic = async () => {
    if (!localParticipant) return;
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
        Alert.alert('Request Sent', 'Microphone unmute request sent to host.');
      }
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
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
        Alert.alert('Request Sent', 'Camera enable request sent to host.');
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
    if (localParticipant) {
      try {
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  };

  // Queue Handlers
  const myIdentity = localParticipant?.identity || 'You';
  const isInQueue = queueList.some((item) => item.id === myIdentity);

  const toggleQueueStatus = async () => {
    const timestamp = Date.now();
    if (isInQueue) {
      setQueueList((prev) => prev.filter((item) => item.id !== myIdentity));
      await sendDataPacket({ type: 'QUEUE_LEAVE' });
    } else {
      setQueueList((prev) => {
        const updated = [...prev, { id: myIdentity, name: myIdentity, timestamp }];
        return updated.sort((a, b) => a.timestamp - b.timestamp);
      });
      await sendDataPacket({ type: 'QUEUE_JOIN', name: myIdentity, timestamp });
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    const text = messageInput.trim();
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: myIdentity,
      text: text,
      isLocal: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setMessageInput('');
    await sendDataPacket({ type: 'CHAT', text });
  };

  const toggleHandRaise = async () => {
    const currentStatus = !!handRaisedUsers[myIdentity];
    const newStatus = !currentStatus;

    setHandRaisedUsers((prev) => ({
      ...prev,
      [myIdentity]: newStatus,
    }));

    await sendDataPacket({ type: 'RAISE_HAND', isRaised: newStatus });
    setIsEmojiVisible(false);
  };

  const sendEmojiReaction = async (emoji: string) => {
    setReactions((prev) => ({
      ...prev,
      [myIdentity]: emoji,
    }));

    setTimeout(() => {
      setReactions((prev) => {
        const updated = { ...prev };
        delete updated[myIdentity];
        return updated;
      });
    }, 4000);

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
      console.log('Error leaving room:', e);
    } finally {
      safeExit();
    }
  };

  const isMyHandRaised = !!handRaisedUsers[myIdentity];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.roomTitle}>{roomTitle || 'Official Class Room'}</Text>
          <Text style={styles.participantCount}>👥 {participants.length} Joined</Text>
        </View>
        {timeRemaining !== null && (
          <View style={styles.timerContainer}>
            <Clock color="#10B981" size={16} />
            <Text style={styles.timerText}>{timeRemaining}s</Text>
          </View>
        )}
      </View>

      {/* Video Grid */}
      <View style={styles.mainContent}>
        {tracks.length > 0 ? (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.participant.sid + '_' + item.source}
            renderItem={({ item }) => (
              <ClassTrackTile
                trackReference={item}
                handRaisedUsers={handRaisedUsers}
                reactions={reactions}
              />
            )}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
          />
        ) : (
          <View style={styles.emptyVideoState}>
            <Text style={styles.emptyStateText}>Camera turned off or loading media...</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls Bar */}
      <View style={styles.controlsWrapper}>
        <View style={styles.controlsBar}>
          <TouchableOpacity
            style={[styles.controlBtn, isMicrophoneEnabled ? styles.btnActive : styles.btnMuted]}
            onPress={toggleMic}
          >
            {isMicrophoneEnabled ? <Mic color="#FFF" size={20} /> : <MicOff color="#FFF" size={20} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, isCameraEnabled ? styles.btnActive : styles.btnMuted]}
            onPress={toggleCamera}
          >
            {isCameraEnabled ? <Video color="#FFF" size={20} /> : <VideoOff color="#FFF" size={20} />}
          </TouchableOpacity>

          {/* Screen Share */}
          <TouchableOpacity
            style={[styles.controlBtn, isScreenShareEnabled ? styles.btnActive : styles.btnMuted]}
            onPress={toggleScreenShare}
          >
            <ScreenShare color="#FFF" size={20} />
          </TouchableOpacity>

          {/* Session Queue Icon */}
          <TouchableOpacity
            style={[styles.controlBtn, queueList.length > 0 ? styles.btnActive : styles.btnMuted]}
            onPress={() => setIsQueueVisible(true)}
          >
            <Users color="#FFF" size={20} />
          </TouchableOpacity>

          {/* Emoji */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.btnMuted]}
            onPress={() => setIsEmojiVisible(true)}
          >
            <Smile color="#FFF" size={20} />
          </TouchableOpacity>

          {/* Chat */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.btnMuted]}
            onPress={() => setIsChatVisible(true)}
          >
            <MessageSquare color="#FFF" size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={handleLeaveCall}>
            <PhoneOff color="#FFF" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔔 HOST APPROVAL & TIME LIMIT MODAL */}
      <Modal visible={!!incomingRequest} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.approvalCard}>
            <Text style={styles.approvalTitle}>Permission Request</Text>
            <Text style={styles.approvalSub}>
              <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{incomingRequest?.senderName}</Text>{' '}
              wants to unmute their <Text style={{ color: '#3B82F6' }}>{incomingRequest?.mediaType}</Text>.
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

      {/* 📋 SESSION QUEUE MODAL */}
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

          <TouchableOpacity style={styles.queueActionBtn} onPress={toggleQueueStatus}>
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
                <Text style={styles.emptyQueueText}>No students in queue currently.</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* 💬 CHAT MODAL SHEET */}
      <Modal visible={isChatVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.chatSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>In-Class Chat</Text>
              <TouchableOpacity onPress={() => setIsChatVisible(false)}>
                <X color="#94A3B8" size={22} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={chatMessages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatList}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.chatBubble,
                    item.isLocal ? styles.chatBubbleLocal : styles.chatBubbleRemote,
                  ]}
                >
                  <Text style={styles.chatSender}>{item.isLocal ? 'You' : item.sender}</Text>
                  <Text style={styles.chatText}>{item.text}</Text>
                  <Text style={styles.chatTime}>{item.time}</Text>
                </View>
              )}
            />

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#64748B"
                value={messageInput}
                onChangeText={setMessageInput}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                <Send color="#FFF" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 😃 EMOJI MODAL SHEET */}
      <Modal visible={isEmojiVisible} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsEmojiVisible(false)}
        >
          <View style={styles.emojiSheet}>
            <Text style={styles.sheetTitleCenter}>Reactions & Actions</Text>

            <TouchableOpacity
              style={[
                styles.raiseHandBtn,
                isMyHandRaised ? styles.raiseHandBtnActive : styles.raiseHandBtnInactive,
              ]}
              onPress={toggleHandRaise}
            >
              <Hand color={isMyHandRaised ? '#10B981' : '#FFF'} size={22} />
              <Text style={styles.raiseHandText}>
                {isMyHandRaised ? 'Lower Hand ✋' : 'Raise Hand ✋'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.emojiGrid}>
              {['👏', '👍', '❤️', '🔥', '😂', '😮'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiItem}
                  onPress={() => sendEmojiReaction(emoji)}
                >
                  <Text style={styles.emojiIcon}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default function ClassRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId } = route?.params || {};
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const prepare = async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ]);
        }
        await AudioSession.startAudioSession();
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
  }, []);

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
      <LiveKitRoom serverUrl={serverUrl} token={token} connect={canConnect} audio={true} video={true}>
        <ClassRoomView
          safeExit={() => navigation.goBack()}
          roomTitle={roomTitle}
          isHost={isHost}
          roomId={roomId}
        />
      </LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justify: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  participantCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  timerText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  participantTile: {
    flex: 1,
    margin: 4,
    height: 190,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  videoStream: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  tileOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tileName: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  handRaiseBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  handRaiseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  reactionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 20,
  },
  reactionText: {
    fontSize: 20,
  },
  emptyVideoState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
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
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: '#2563EB',
  },
  btnMuted: {
    backgroundColor: '#334155',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
  },

  /* 🔔 APPROVAL MODAL STYLES */
  approvalCard: {
    width: '85%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  approvalSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
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
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
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
    borderRadius: 12,
    gap: 6,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  /* 📋 SESSION QUEUE STYLES */
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

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
  },
  chatSheet: {
    height: '60%',
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sheetTitleCenter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 16,
  },
  chatList: {
    paddingBottom: 12,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  chatBubbleLocal: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
  },
  chatBubbleRemote: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
  },
  chatSender: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  chatText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  chatTime: {
    fontSize: 9,
    color: '#CBD5E1',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  raiseHandBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  raiseHandBtnInactive: {
    backgroundColor: '#334155',
  },
  raiseHandBtnActive: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  raiseHandText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  emojiItem: {
    padding: 8,
  },
  emojiIcon: {
    fontSize: 28,
  },
});