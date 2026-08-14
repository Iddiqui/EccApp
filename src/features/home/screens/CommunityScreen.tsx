import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  Platform, 
  ActivityIndicator, 
  Alert,
  StatusBar,
  Modal,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  PermissionsAndroid
} from 'react-native';
import { 
  Trash2, Send, Trophy, Plus, X, CheckCircle, Flame, 
  HelpCircle, Sparkles, MessageCircle, Users, Headset, Mic, Paperclip, 
  Play, Pause, MoreVertical, XCircle, Check, CheckCheck, Clock, ShieldCheck, ChevronRight, AlertTriangle, Smile
} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// 🎙️ BULLETPROOF AUDIO RECORD & SOUND PLAYER
import AudioRecord from 'react-native-audio-record';

// Native Sound Player Initialization
let SoundPlayer: any = null;
try {
  const SoundModule = require('react-native-sound');
  SoundPlayer = SoundModule.default ? SoundModule.default : SoundModule;
  if (SoundPlayer && SoundPlayer.setCategory) {
    SoundPlayer.setCategory('Playback', true); 
  }
} catch (e) {
  console.log("react-native-sound missing");
}

//@ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../../../hooks/useTheme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const AVATAR_COLORS = ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316', '#3B82F6', '#D946EF'];

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
  '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🧠', '🫀', '👀', '👁️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨'
];

const getAvatarColor = (str: string = 'User') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatMessageTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// 🗓️ DATE HEADER FORMATTER
const getMessageDateHeader = (timestamp: any) => {
  if (!timestamp) return 'Today';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }
};

const CommunityScreen = () => {
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const t = themeContext?.t;
  const currentUser = auth().currentUser;

  // 🎨 DYNAMIC THEME COLORS SYNC
  const colors = themeContext?.theme?.colors || {
    primary: '#8B5CF6', 
    primaryGlow: 'rgba(139, 92, 246, 0.25)',
    bgLight: isDarkMode ? '#0F172A' : '#F1F5F9',
    bgCard: isDarkMode ? '#1E293B' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B'
  };

  const primaryColor = colors.primary || '#8B5CF6';

  const TABS = [t?.community?.feed || 'Feed', 'Chats', t?.community?.challenges || 'Challenges', t?.community?.leaderboard || 'Leaderboard'];

  const [activeTab, setActiveTab] = useState(1);
  const pagerRef = useRef<ScrollView>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // Real-time Dynamic Member & Online Stats
  const [totalMembers, setTotalMembers] = useState(1);
  const [onlineMembers, setOnlineMembers] = useState(0);

  // Group Chat States
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Emoji Picker Tray State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message Reaction Popover State
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<any>(null);

  // Custom Delete Modal States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Voice Recording & Playback States
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState('00:00');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Recording Timer & Active Sound Ref
  const timerRef = useRef<any>(null);
  const activeSoundRef = useRef<any>(null);

  // Feed States
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Challenges States
  const [challengesData, setChallengesData] = useState<any[]>([]);
  const [completedQuizIds, setCompletedQuizIds] = useState<string[]>([]);

  // Student Quiz Attempt States
  const [isStudentQuizModalVisible, setIsStudentQuizModalVisible] = useState(false);
  const [currentTakingQuiz, setCurrentTakingQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userSelectedOption, setUserSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);

  // 🔄 TAB PRESS & SWIPE SYNC LOGIC
  const handleTabPress = (idx: number) => {
    setActiveTab(idx);
    pagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  const handleScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (pageIndex !== activeTab && pageIndex >= 0 && pageIndex < TABS.length) {
      setActiveTab(pageIndex);
    }
  };

  // 🔊 QUIZ SOUND EFFECTS
  const playQuizSound = (isCorrect: boolean) => {
    if (!SoundPlayer) return;
    try {
      const fileName = isCorrect ? 'correct_sound.wav' : 'wrong_sound.wav';
      const sound = new SoundPlayer(fileName, SoundPlayer.MAIN_BUNDLE, (error: any) => {
        if (!error) {
          if (sound.setSpeakerphoneOn) sound.setSpeakerphoneOn(true);
          sound.play(() => sound.release());
        }
      });
    } catch (e) {}
  };

  // 🚀 CHAT ONLINE/OFFLINE STATUS
  const openChatModal = (groupData: any) => {
    setSelectedGroup(groupData);
    setIsChatModalVisible(true);
    setShowEmojiPicker(false);
    if (currentUser?.uid) {
      firestore().collection('users').doc(currentUser.uid).set({
        isOnline: true,
        lastSeen: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  };

  const closeChatModal = () => {
    setIsChatModalVisible(false);
    setShowEmojiPicker(false);
    setSelectedMessageForReaction(null);
    if (activeSoundRef.current) {
      try { activeSoundRef.current.stop(); activeSoundRef.current.release(); } catch (e) {}
      activeSoundRef.current = null;
    }
    setPlayingAudioId(null);

    if (currentUser?.uid) {
      firestore().collection('users').doc(currentUser.uid).set({
        isOnline: false,
        lastSeen: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  };

  // Admin Check
  useEffect(() => {
    let isMounted = true;
    const checkAdmin = async () => {
      if (!currentUser?.email) return;
      try {
        const q = await firestore().collection('admins').where('email', '==', currentUser.email).get();
        if (isMounted) setIsAdmin(!q.empty);
      } catch (e) {}
    };
    checkAdmin();
    return () => { isMounted = false; };
  }, [currentUser?.email]);

  // Real-time Database Listener for Active Users
  useEffect(() => {
    const unsubUsers = firestore().collection('users').onSnapshot((snap) => {
      if (snap) {
        let validUsers = 0;
        let onlineCount = 0;

        snap.forEach(doc => {
          const data = doc.data();
          // Filter valid users only
          if (data && (data.email || data.uid || data.fullName)) {
            validUsers++;
          }
          if (data && data.isOnline === true) {
            onlineCount++;
          }
        });

        setTotalMembers(validUsers > 0 ? validUsers : 1);
        setOnlineMembers(onlineCount);
      }
    });

    const unsubPosts = firestore().collection('posts').orderBy('createdAt', 'desc').onSnapshot((snap) => {
      let list: any[] = [];
      snap?.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setPosts(list);
    });

    const unsubQuiz = firestore().collection('challenges').orderBy('createdAt', 'desc').onSnapshot((snap) => {
      let list: any[] = [];
      snap?.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setChallengesData(list);
    });

    let unsubResults = () => {};
    if (currentUser?.uid) {
      unsubResults = firestore().collection('quiz_results').where('userId', '==', currentUser.uid).onSnapshot((snap) => {
        let done: string[] = [];
        snap?.forEach((doc) => done.push(doc.data().quizId));
        setCompletedQuizIds(done);
      });
    }

    const unsubLB = firestore().collection('users').orderBy('xp', 'desc').limit(20).onSnapshot((snap) => {
      let list: any[] = [];
      snap?.forEach((doc) => {
        if (doc.data().xp && doc.data().xp > 0) list.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboardUsers(list);
    });

    return () => {
      unsubUsers();
      unsubPosts();
      unsubQuiz();
      unsubResults();
      unsubLB();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedGroup) return;
    return firestore()
      .collection('community_groups')
      .doc(selectedGroup.id)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snap) => {
        let msgs: any[] = [];
        snap?.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() }));
        setChatMessages(msgs);
      });
  }, [selectedGroup]);

  // Initial scroll positioning
  useEffect(() => {
    setTimeout(() => {
      pagerRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
    }, 100);
  }, []);

  // 🎙️ START RECORDING WITH DYNAMIC FILENAME
  const handleStartRecording = async () => {
    setShowEmojiPicker(false);
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Required', 'Microphone permission is required to record voice notes.');
          return;
        }
      } catch (err) {
        return;
      }
    }

    try {
      const uniqueFileName = `voice_${Date.now()}.wav`;

      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6, // MIC
        wavFile: uniqueFileName
      });

      setIsRecording(true);
      setRecordSecs(0);
      setRecordTime('00:00');

      AudioRecord.start();

      let secs = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        secs += 1;
        setRecordSecs(secs);
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        setRecordTime(`${m}:${s}`);
      }, 1000);

    } catch (e: any) {
      setIsRecording(false);
      Alert.alert('Recording Error', e.message || 'Unable to start recording');
    }
  };

  const handleCancelRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await AudioRecord.stop();
    } catch (e) {}
    setIsRecording(false);
    setRecordSecs(0);
  };

  // 🎙️ STOP AND SEND VOICE NOTE TO FIRESTORE
  const handleStopAndSendRecording = async () => {
    if (!selectedGroup) return;

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      let audioFilePath = await AudioRecord.stop();
      setIsRecording(false);

      const finalDuration = recordSecs > 0 ? recordSecs : 2;

      await firestore().collection('community_groups').doc(selectedGroup.id).collection('messages').add({
        text: `Voice Note`,
        type: 'voice',
        duration: finalDuration,
        mediaUrl: audioFilePath, 
        senderId: currentUser?.uid || 'guest_user',
        senderName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
        status: 'sent',
        reactions: {},
        createdAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {
      setIsRecording(false);
      Alert.alert('Error', e.message);
    }
  };

  // 🔊 UNIVERSAL AUDIO PLAYBACK LOGIC
  const handleTogglePlayAudio = async (msgId: string, durationInSec: number = 2, mediaUrl?: string) => {
    if (playingAudioId === msgId) {
      if (activeSoundRef.current) {
        try { 
          activeSoundRef.current.stop(); 
          activeSoundRef.current.release(); 
        } catch (e) {}
        activeSoundRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    if (!mediaUrl || !SoundPlayer) {
      Alert.alert("Voice Playback", "Voice audio file missing.");
      return;
    }

    if (activeSoundRef.current) {
      try { 
        activeSoundRef.current.stop(); 
        activeSoundRef.current.release(); 
      } catch (e) {}
      activeSoundRef.current = null;
    }

    setPlayingAudioId(msgId);

    try {
      let targetPath = mediaUrl;
      if (Platform.OS === 'android') {
        if (targetPath.startsWith('file://')) {
          targetPath = targetPath.replace('file://', '');
        }
      }

      if (SoundPlayer.setCategory) {
        SoundPlayer.setCategory('Playback', true);
      }

      const sound = new SoundPlayer(targetPath, Platform.OS === 'android' ? '' : SoundPlayer.MAIN_BUNDLE, (error: any) => {
        if (error) {
          console.log('Failed to load sound:', error);
          setPlayingAudioId(null);
          activeSoundRef.current = null;
          return;
        }

        activeSoundRef.current = sound;

        if (sound.setSpeakerphoneOn) {
          sound.setSpeakerphoneOn(true);
        }
        sound.setVolume(1.0);

        sound.play((success: boolean) => {
          try { sound.release(); } catch(e){}
          activeSoundRef.current = null;
          setPlayingAudioId(null);
        });
      });
    } catch (e) {
      setPlayingAudioId(null);
      activeSoundRef.current = null;
    }
  };

  // 💖 REACTION TOGGLE & REMOVE LOGIC
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!selectedGroup || !currentUser?.uid) return;
    try {
      const msgRef = firestore()
        .collection('community_groups')
        .doc(selectedGroup.id)
        .collection('messages')
        .doc(messageId);

      const msgDoc = await msgRef.get();
      const existingReactions = msgDoc.data()?.reactions || {};

      if (existingReactions[currentUser.uid] === emoji) {
        delete existingReactions[currentUser.uid];
      } else {
        existingReactions[currentUser.uid] = emoji;
      }

      await msgRef.update({ reactions: existingReactions });
    } catch (e) {
      console.log('Reaction Error:', e);
    } finally {
      setSelectedMessageForReaction(null);
    }
  };

  // 🛑 DIRECT REMOVE REACTION VIA BADGE TAP
  const handleRemoveMyReaction = async (messageId: string) => {
    if (!selectedGroup || !currentUser?.uid) return;
    try {
      const msgRef = firestore()
        .collection('community_groups')
        .doc(selectedGroup.id)
        .collection('messages')
        .doc(messageId);

      const msgDoc = await msgRef.get();
      const existingReactions = msgDoc.data()?.reactions || {};

      if (existingReactions[currentUser.uid]) {
        delete existingReactions[currentUser.uid];
        await msgRef.update({ reactions: existingReactions });
      }
    } catch (e) {
      console.log('Remove Reaction Error:', e);
    }
  };

  // Trigger Custom Delete Modal
  const promptDeleteChatMessage = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteModalVisible(true);
  };

  // Confirm Delete Action
  const confirmDeleteChatMessage = async () => {
    if (!selectedGroup || !messageToDelete) return;
    setIsDeleting(true);
    try {
      setChatMessages(prev => prev.filter(msg => msg.id !== messageToDelete));
      await firestore()
        .collection('community_groups')
        .doc(selectedGroup.id)
        .collection('messages')
        .doc(messageToDelete)
        .delete();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      setMessageToDelete(null);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !currentUser) return;
    setIsPosting(true);
    try {
      await firestore().collection('posts').add({
        text: newPostText.trim(),
        uid: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      setNewPostText('');
    } catch (e: any) { Alert.alert('Error', e.message); } 
    finally { setIsPosting(false); }
  };

  const handleDeletePost = (id: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => firestore().collection('posts').doc(id).delete() }
    ]);
  };

  const handleSendGroupMessage = async () => {
    if (!chatInputText.trim() || !selectedGroup) return;
    setIsSendingChat(true);
    setShowEmojiPicker(false);
    try {
      await firestore().collection('community_groups').doc(selectedGroup.id).collection('messages').add({
        text: chatInputText.trim(),
        type: 'text',
        senderId: currentUser?.uid || 'guest_user',
        senderName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
        status: 'sent',
        reactions: {},
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      setChatInputText('');
    } catch (e: any) { Alert.alert('Error', e.message); } 
    finally { setIsSendingChat(false); }
  };

  const handleShareMedia = () => {
    Alert.alert("Share File", "Choose media type to upload", [
      { text: "📷 Camera", onPress: () => console.log("Camera") },
      { text: "🖼️ Gallery Image", onPress: () => console.log("Image") },
      { text: "📄 PDF Document", onPress: () => console.log("PDF") },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  // Quiz Attempt Handlers
  const handleStartQuiz = (quiz: any) => {
    if (completedQuizIds.includes(quiz.id)) {
      Alert.alert('Attempted', 'You already attempted this quiz.');
      return;
    }
    setCurrentTakingQuiz(quiz);
    setCurrentQuestionIndex(0);
    setUserSelectedOption(null);
    setIsAnswerSubmitted(false);
    setCalculatedScore(0);
    setQuizCompleted(false);
    setShowConfetti(false);
    setIsStudentQuizModalVisible(true);
  };

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setUserSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (userSelectedOption === null) return;
    const activeQ = currentTakingQuiz?.questions?.[currentQuestionIndex];
    if (userSelectedOption === activeQ?.correctAnswerIndex) {
      setCalculatedScore(s => s + 1);
      setShowConfetti(true);
      playQuizSound(true);
    } else {
      setShowConfetti(false);
      playQuizSound(false);
    }
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    const totalQ = currentTakingQuiz?.questions?.length || 0;
    setShowConfetti(false);
    if (currentQuestionIndex + 1 < totalQ) {
      setCurrentQuestionIndex(i => i + 1);
      setUserSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizCompleted(true);
      submitScoreToLeaderboard(calculatedScore, totalQ);
    }
  };

  const submitScoreToLeaderboard = async (finalScore: number, totalQ: number) => {
    if (!currentUser || !currentTakingQuiz) return;
    try {
      const earnedXP = finalScore * 10;
      await firestore().collection('quiz_results').add({
        quizId: currentTakingQuiz.id,
        quizTitle: currentTakingQuiz.title || 'Challenge',
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        score: finalScore,
        totalQuestions: totalQ,
        earnedXP: earnedXP,
        completedAt: firestore.FieldValue.serverTimestamp()
      });

      await firestore().collection('users').doc(currentUser.uid).set({
        xp: firestore.FieldValue.increment(earnedXP)
      }, { merge: true });
    } catch (error) {}
  };

  const activeQuizTotal = currentTakingQuiz?.questions?.length || 0;
  const activeQuizQuestion = currentTakingQuiz?.questions?.[currentQuestionIndex];

  // Helper to Render Message Status Ticks
  const renderMessageTicks = (item: any) => {
    if (onlineMembers > 1) {
      return <CheckCheck size={13} color="#38BDF8" style={{ marginLeft: 4 }} />;
    } else if (item.status === 'delivered') {
      return <CheckCheck size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    } else {
      return <Check size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    }
  };

  // Helper to Render Reaction Badges
  const renderReactionsSummary = (item: any) => {
    const reactions = item?.reactions || {};
    const reactionValues: string[] = Object.values(reactions);
    if (reactionValues.length === 0) return null;

    const uniqueEmojis = Array.from(new Set(reactionValues)).slice(0, 3);
    const hasMyReaction = currentUser?.uid && reactions[currentUser.uid];

    return (
      <TouchableOpacity 
        style={[
          styles.reactionsSummaryBadge, 
          hasMyReaction && { borderColor: primaryColor, backgroundColor: primaryColor + '25' }
        ]}
        onPress={() => handleRemoveMyReaction(item.id)}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 11 }}>{uniqueEmojis.join(' ')}</Text>
        {reactionValues.length > 1 && (
          <Text style={styles.reactionCountText}>{reactionValues.length}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} translucent />

      {/* Main Header */}
      <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t?.community?.title || 'Community'}</Text>
            <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>{t?.community?.subtitle || 'Connect, Learn & Rank'}</Text>
          </View>
          <View style={[styles.verifiedGlowBadge, { backgroundColor: primaryColor + '1F' }]}>
            <ShieldCheck size={16} color={primaryColor} />
            <Text style={[styles.verifiedGlowText, { color: primaryColor }]}>Official</Text>
          </View>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === idx && [styles.activeTab, { backgroundColor: colors.bgCard }]]} onPress={() => handleTabPress(idx)}>
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === idx && { color: primaryColor, fontWeight: '800' }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 🌟 HORIZONTAL SWIPE PAGER */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ flex: 1 }}
      >
        {/* TAB 0: FEED */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View style={[styles.createPostBox, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: primaryColor }]}>
            <TextInput style={[styles.postInput, { color: colors.textPrimary }]} placeholder="Post an update or query..." placeholderTextColor={colors.textSecondary} value={newPostText} onChangeText={setNewPostText} multiline />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }, !newPostText.trim() && { opacity: 0.5 }]} onPress={handleCreatePost} disabled={isPosting || !newPostText.trim()}>
              {isPosting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={16} color="#FFF" />}
            </TouchableOpacity>
          </View>
          <FlatList 
            data={posts} 
            keyExtractor={item => item.id} 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollList} 
            renderItem={({ item }) => {
              const canDelete = isAdmin || (currentUser?.uid && item.uid === currentUser.uid);
              return (
                <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: primaryColor }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.avatarGlow, { backgroundColor: getAvatarColor(item.userName) }]}><Text style={styles.avatarText}>{item.userName?.charAt(0).toUpperCase() || 'U'}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userNameText, { color: colors.textPrimary }]}>{item.userName || 'User'}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{formatTimeAgo(item.createdAt)}</Text>
                      </View>
                    </View>
                    {canDelete && (
                      <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={styles.deleteIconButton}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ color: colors.textPrimary, marginTop: 10, fontSize: 14, lineHeight: 21 }}>{item.text}</Text>
                </View>
              );
            }}
          />
        </View>

        {/* TAB 1: CHATS & VOICE ROOMS */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Community Groups</Text>
            
            <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: primaryColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={[styles.chatIconGlowWrap, { backgroundColor: primaryColor + '1F' }]}>
                  <MessageCircle color={primaryColor} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>Ecc Community Chat</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Official ECC Global Chat Room</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <View style={[styles.badgePillPrimary, { backgroundColor: primaryColor + '20' }]}>
                      <Users size={12} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{totalMembers} members</Text>
                    </View>
                    <View style={[styles.badgePillStatus, { backgroundColor: onlineMembers > 0 ? primaryColor + '20' : 'rgba(148, 163, 184, 0.18)' }]}>
                      <View style={[styles.greenDot, { backgroundColor: onlineMembers > 0 ? primaryColor : '#64748B' }]} />
                      <Text style={{ color: onlineMembers > 0 ? primaryColor : '#64748B', fontSize: 11, fontWeight: '700' }}>
                        {onlineMembers > 0 ? `${onlineMembers} Online` : 'Offline'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.openGroupBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
                onPress={() => openChatModal({ id: 'ecc_community_chat', title: 'Ecc Community Chat' })}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15, marginRight: 6 }}>Open Group Chat</Text>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: primaryColor + '20', justifyContent: 'center', alignItems: 'center' }}>
                  <Headset color={primaryColor} size={20} />
                </View>
                <Text style={[styles.sectionHeading, { marginTop: 0, color: colors.textPrimary }]}>Voice Rooms</Text>
              </View>
              <TouchableOpacity><Text style={{ color: primaryColor, fontWeight: '700', fontSize: 13 }}>Join Room ›</Text></TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {[{ title: 'Beginner', desc: 'New learners', emoji: '🚀' }, { title: 'Intermediate', desc: 'Growing together', emoji: '🎤' }, { title: 'Expert', desc: 'Advanced talk', emoji: '🎧' }].map((room, i) => (
                <TouchableOpacity key={i} style={[styles.voiceRoomCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: primaryColor }]} activeOpacity={0.85}>
                  <View style={[styles.voiceEmojiWrap, { backgroundColor: primaryColor + '1F' }]}>
                    <Text style={{ fontSize: 26 }}>{room.emoji}</Text>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 6 }}>{room.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{room.desc}</Text>
                  <View style={[styles.onlineBadge, { marginTop: 12, backgroundColor: onlineMembers > 0 ? primaryColor + '20' : 'rgba(148, 163, 184, 0.15)' }]}>
                    <View style={[styles.greenDot, { backgroundColor: onlineMembers > 0 ? primaryColor : '#64748B' }]} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: onlineMembers > 0 ? primaryColor : '#64748B' }}>
                      {onlineMembers > 0 ? `${onlineMembers} Online` : 'Offline'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>

        {/* TAB 2: CHALLENGES / QUIZ */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <FlatList 
            data={challengesData} 
            keyExtractor={item => item.id} 
            contentContainerStyle={styles.scrollList} 
            renderItem={({ item }) => {
              const isDone = completedQuizIds.includes(item.id);
              const totalQ = item?.questions?.length || item?.totalQuestions || 0;

              return (
                <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: primaryColor }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                      <View style={[styles.quizIconGlowContainer, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                        <Trophy size={22} color="#F59E0B" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={[styles.quizTitleText, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{totalQ} Questions</Text>
                          <View style={styles.xpPillBadge}>
                            <Sparkles size={11} color="#F59E0B" />
                            <Text style={styles.xpPillText}>+{totalQ * 10} XP</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {isDone ? (
                    <View style={[styles.completedStatusBanner, { backgroundColor: primaryColor + '20' }]}>
                      <CheckCircle size={16} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Completed</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.startQuizButton, { backgroundColor: primaryColor, shadowColor: primaryColor }]} onPress={() => handleStartQuiz(item)} activeOpacity={0.85}>
                      <Text style={styles.actionBtnText}>Start Quiz Challenge</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }} 
          />
        </View>

        {/* TAB 3: LEADERBOARD */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <FlatList 
            data={leaderboardUsers} 
            keyExtractor={item => item.id} 
            contentContainerStyle={styles.scrollList} 
            renderItem={({ item, index }) => {
              const rawName = item.fullName || item.userName || 'User';
              const isTop1 = index === 0;
              const isTop2 = index === 1;
              const isTop3 = index === 2;

              return (
                <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', shadowColor: primaryColor }]}>
                  <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                    {isTop1 ? <Text style={{ fontSize: 22 }}>🥇</Text> : 
                     isTop2 ? <Text style={{ fontSize: 22 }}>🥈</Text> : 
                     isTop3 ? <Text style={{ fontSize: 22 }}>🥉</Text> : 
                     <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textSecondary }}>#{index + 1}</Text>}
                  </View>

                  <View style={[styles.avatarGlow, { backgroundColor: getAvatarColor(rawName), marginLeft: 8 }]}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{rawName.charAt(0).toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.userNameText, { color: colors.textPrimary, fontSize: 15 }]}>{rawName}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Flame size={16} color="#EF4444" />
                    <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 4, fontSize: 13 }}>{item.xp || 0} XP</Text>
                  </View>
                </View>
              );
            }} 
          />
        </View>
      </ScrollView>

      {/* 💬 REAL CHAT APP GROUP MODAL */}
      <Modal visible={isChatModalVisible} animationType="slide" onRequestClose={closeChatModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={{ 
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, 
              backgroundColor: colors.bgCard, borderBottomWidth: 1, borderColor: colors.border,
              paddingTop: Platform.OS === 'ios' ? 55 : (StatusBar.currentHeight || 0) + 15
            }}>
              <TouchableOpacity onPress={closeChatModal} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{selectedGroup?.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{totalMembers} Members</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>•</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.greenDot, { backgroundColor: onlineMembers > 0 ? primaryColor : '#64748B' }]} />
                    <Text style={{ fontSize: 11, color: onlineMembers > 0 ? primaryColor : '#64748B', fontWeight: '700' }}>
                      {onlineMembers > 0 ? `${onlineMembers} Online` : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Chat List */}
            <View style={{ flex: 1, width: '100%' }}>
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                inverted
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                renderItem={({ item, index }) => {
                  const isMe = item.senderId === (currentUser?.uid || 'guest_user');
                  const isPlaying = playingAudioId === item.id;
                  const canDelete = isAdmin || isMe;

                  const currentDateHeader = getMessageDateHeader(item.createdAt);
                  const nextMessage = chatMessages[index + 1];
                  const nextDateHeader = nextMessage ? getMessageDateHeader(nextMessage.createdAt) : null;
                  const showDateHeader = currentDateHeader !== nextDateHeader;

                  return (
                    <View style={{ width: '100%' }}>
                      {showDateHeader && (
                        <View style={{ alignItems: 'center', marginVertical: 12 }}>
                          <View style={{ backgroundColor: isDarkMode ? '#2A2A2A' : '#E2E8F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                              {currentDateHeader}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginVertical: 6, maxWidth: '85%' }}>
                        {!isMe && <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2, fontWeight: '700', marginLeft: 4 }}>{item.senderName}</Text>}
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity 
                            activeOpacity={0.9} 
                            onLongPress={() => setSelectedMessageForReaction(item)}
                            onPress={() => setSelectedMessageForReaction(selectedMessageForReaction?.id === item.id ? null : item)}
                            style={{ 
                              backgroundColor: isMe ? primaryColor : colors.bgCard, 
                              padding: 12, 
                              borderRadius: 18, 
                              borderWidth: isMe ? 0 : 1, 
                              borderColor: colors.border, 
                              shadowColor: primaryColor 
                            }}
                          >
                            {item.type === 'voice' ? (
                              <TouchableOpacity onPress={() => handleTogglePlayAudio(item.id, item.duration, item.mediaUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isMe ? '#FFF' : primaryColor, justifyContent: 'center', alignItems: 'center' }}>
                                  {isPlaying ? <Pause size={18} color={isMe ? primaryColor : '#FFF'} /> : <Play size={18} color={isMe ? primaryColor : '#FFF'} style={{ marginLeft: 2 }} />}
                                </View>
                                <View>
                                  <Text style={{ color: isMe ? '#FFF' : colors.textPrimary, fontWeight: '800', fontSize: 13 }}>Voice Note</Text>
                                  <Text style={{ color: isMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary, fontSize: 11 }}>{item.duration || 2}s</Text>
                                </View>
                              </TouchableOpacity>
                            ) : (
                              <Text style={{ color: isMe ? '#FFF' : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                            )}
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                              <Text style={{ color: isMe ? 'rgba(255,255,255,0.75)' : colors.textSecondary, fontSize: 9, fontWeight: '500' }}>
                                {formatMessageTime(item.createdAt)}
                              </Text>
                              {isMe && renderMessageTicks(item)}
                            </View>

                            {renderReactionsSummary(item)}
                          </TouchableOpacity>

                          {canDelete && (
                            <TouchableOpacity onPress={() => promptDeleteChatMessage(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 4 }}>
                              <MoreVertical size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            </View>

            {/* Emoji Picker Tray */}
            {showEmojiPicker && (
              <View style={[styles.emojiPickerTray, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>Choose Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}><X size={16} color={colors.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8 }}>
                  {EMOJI_LIST.map((emoji, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={{ width: '10%', paddingVertical: 8, alignItems: 'center' }}
                      onPress={() => setChatInputText(prev => prev + emoji)}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, backgroundColor: colors.bgCard, borderColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={{ padding: 6 }}>
                <Smile size={22} color={showEmojiPicker ? primaryColor : colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShareMedia} style={{ padding: 6 }}>
                <Paperclip size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {isRecording ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginHorizontal: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 8 }} />
                  <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13, flex: 1 }}>{recordTime}</Text>
                  <TouchableOpacity onPress={handleCancelRecording} style={{ padding: 4 }}>
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={{ flex: 1, color: colors.textPrimary, backgroundColor: colors.bgLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, fontSize: 14, marginHorizontal: 6 }}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textSecondary}
                  value={chatInputText}
                  onChangeText={setChatInputText}
                  onFocus={() => setShowEmojiPicker(false)}
                />
              )}

              {isRecording ? (
                <TouchableOpacity onPress={handleStopAndSendRecording} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: primaryColor, justifyContent: 'center', alignItems: 'center', shadowColor: primaryColor }}>
                  <Send size={16} color="#FFF" />
                </TouchableOpacity>
              ) : chatInputText.trim().length > 0 ? (
                <TouchableOpacity onPress={handleSendGroupMessage} disabled={isSendingChat} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: primaryColor, justifyContent: 'center', alignItems: 'center', shadowColor: primaryColor }}>
                  {isSendingChat ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={18} color="#FFF" />}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleStartRecording} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: primaryColor, justifyContent: 'center', alignItems: 'center', shadowColor: primaryColor }}>
                  <Mic size={18} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Reaction Picker Overlay */}
        {selectedMessageForReaction && (
          <Modal transparent visible={true} animationType="fade" onRequestClose={() => setSelectedMessageForReaction(null)}>
            <TouchableOpacity style={styles.reactionOverlayBg} activeOpacity={1} onPress={() => setSelectedMessageForReaction(null)}>
              <View style={[styles.reactionPickerBar, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity 
                    key={emoji} 
                    style={styles.reactionEmojiItem} 
                    onPress={() => handleAddReaction(selectedMessageForReaction.id, emoji)}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent={true} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
            
            <View style={styles.deleteIconBadge}>
              <AlertTriangle size={28} color="#EF4444" />
            </View>

            <Text style={[styles.deleteTitle, { color: colors.textPrimary }]}>Delete Message</Text>
            <Text style={[styles.deleteSubtitle, { color: colors.textSecondary }]}>
              Are you sure you want to permanently delete this message? This action cannot be undone.
            </Text>

            <View style={styles.deleteActionContainer}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} 
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.confirmDeleteBtn} 
                onPress={confirmDeleteChatMessage}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Student Quiz Modal */}
      <Modal visible={isStudentQuizModalVisible && currentTakingQuiz !== null} animationType="fade" transparent={true} onRequestClose={() => setIsStudentQuizModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 }}>
          {showConfetti && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} pointerEvents="none">
              <ConfettiCannon count={150} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut autoStart />
            </View>
          )}

          <View style={{ backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderRadius: 20, padding: 20, maxHeight: SCREEN_HEIGHT * 0.85, shadowColor: primaryColor }}>
            {quizCompleted ? (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <CheckCircle size={60} color={primaryColor} />
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 10 }}>Quiz Finished!</Text>
                <Text style={{ fontSize: 16, color: primaryColor, fontWeight: '700', marginTop: 6 }}>Score: {calculatedScore} / {activeQuizTotal}</Text>
                <TouchableOpacity style={{ backgroundColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 20, paddingHorizontal: 30, shadowColor: primaryColor }} onPress={() => setIsStudentQuizModalVisible(false)}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', flex: 1, color: colors.textPrimary }}>{currentTakingQuiz?.title}</Text>
                  <TouchableOpacity onPress={() => setIsStudentQuizModalVisible(false)}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: primaryColor, marginBottom: 8 }}>
                  Question {currentQuestionIndex + 1} / {activeQuizTotal}
                </Text>

                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 }}>
                  {activeQuizQuestion?.questionText}
                </Text>

                {activeQuizQuestion?.options?.map((opt: string, index: number) => {
                  const isSelected = userSelectedOption === index;
                  const isCorrect = index === activeQuizQuestion?.correctAnswerIndex;

                  let optionBg = isDarkMode ? '#2A2A2A' : '#F8FAFC';
                  let optionBorder = colors.border;
                  let textColor = colors.textPrimary;

                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      optionBg = isDarkMode ? primaryColor + '33' : '#DCFCE7';
                      optionBorder = primaryColor;
                    } else if (isSelected && !isCorrect) {
                      optionBg = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2';
                      optionBorder = '#EF4444';
                    }
                  } else if (isSelected) {
                    optionBg = primaryColor + '1F';
                    optionBorder = primaryColor;
                  }

                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={{ 
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: 1.5, 
                        borderRadius: 14, 
                        padding: 14, 
                        marginBottom: 10, 
                        backgroundColor: optionBg, 
                        borderColor: optionBorder 
                      }} 
                      onPress={() => handleSelectOption(index)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: textColor, flex: 1 }}>{opt}</Text>
                      {isAnswerSubmitted && isCorrect && <CheckCircle size={20} color={primaryColor} />}
                      {isAnswerSubmitted && isSelected && !isCorrect && <XCircle size={20} color="#EF4444" />}
                    </TouchableOpacity>
                  );
                })}

                {isAnswerSubmitted && (
                  <View style={{ backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', padding: 12, borderRadius: 12, marginTop: 6, marginBottom: 12 }}>
                    <Text style={{ color: '#D97706', fontWeight: '800', fontSize: 13, marginBottom: 4 }}>
                      💡 Correct Answer: {activeQuizQuestion?.options?.[activeQuizQuestion?.correctAnswerIndex]}
                    </Text>
                    {activeQuizQuestion?.explanation ? (
                      <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
                        {activeQuizQuestion.explanation}
                      </Text>
                    ) : null}
                  </View>
                )}

                {!isAnswerSubmitted ? (
                  <TouchableOpacity 
                    style={[{ backgroundColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12, shadowColor: primaryColor }, userSelectedOption === null && { opacity: 0.6 }]} 
                    onPress={handleConfirmAnswer}
                    disabled={userSelectedOption === null}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Submit Answer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={{ backgroundColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12, shadowColor: primaryColor }} onPress={handleNextQuestion}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Next Question</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitleText: { fontSize: 13, marginTop: 2 },
  verifiedGlowBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  verifiedGlowText: { fontSize: 11, fontWeight: '800' },
  tabsContainer: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 16, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  activeTab: { elevation: 3 },
  tabText: { fontSize: 12, fontWeight: '600' },
  scrollList: { paddingHorizontal: 16, paddingBottom: 24 },
  premiumCard: { borderRadius: 22, padding: 18, borderWidth: 1.5, marginBottom: 16 },
  sectionHeading: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  createPostBox: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1.5, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  postInput: { flex: 1, maxHeight: 80, fontSize: 14, paddingRight: 8 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chatIconGlowWrap: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  badgePillPrimary: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgePillStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  openGroupBtn: { paddingVertical: 13, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18, flexDirection: 'row' },
  voiceRoomCard: { width: 145, borderRadius: 22, borderWidth: 1.5, padding: 14, marginRight: 12, alignItems: 'flex-start' },
  voiceEmojiWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  greenDot: { width: 7, height: 7, borderRadius: 3.5 },
  avatarGlow: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  deleteIconButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userNameText: { fontSize: 15, fontWeight: '800' },
  actionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  quizIconGlowContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quizTitleText: { fontSize: 16, fontWeight: '800' },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  xpPillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  xpPillText: { color: '#F59E0B', fontSize: 11, fontWeight: '800' },
  completedStatusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  startQuizButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },

  /* 🗑️ CUSTOM DELETE MODAL STYLES */
  deleteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteModalCard: { width: '100%', maxWidth: 320, borderRadius: 24, padding: 22, borderWidth: 1.5, alignItems: 'center', elevation: 10 },
  deleteIconBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  deleteTitle: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  deleteSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  deleteActionContainer: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  confirmDeleteBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  /* 😃 EMOJI PICKER TRAY STYLES */
  emojiPickerTray: { height: 180, borderTopWidth: 1 },

  /* 💖 REACTION STYLES */
  reactionOverlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  reactionPickerBar: { flexDirection: 'row', borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8, elevation: 10, borderWidth: 1, borderColor: '#334155' },
  reactionEmojiItem: { paddingHorizontal: 8, paddingVertical: 4 },
  reactionsSummaryBadge: { position: 'absolute', bottom: -10, right: 10, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  activeMyReactionBadge: { backgroundColor: 'rgba(139, 92, 246, 0.25)' },
  reactionCountText: { color: '#F8FAFC', fontSize: 9, fontWeight: '800', marginLeft: 3 }
});

export default CommunityScreen;