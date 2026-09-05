import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  StatusBar,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  TextInput,
  Alert,
  PermissionsAndroid
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import AudioRecord from 'react-native-audio-record';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Check, 
  Radio, 
  Sparkles, 
  Mic, 
  Square, 
  Send, 
  Edit3, 
  Award,
  Volume2,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  Headphones
} from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';

// Sound module for playback
let SoundPlayer: any = null;
try {
  const SoundModule = require('react-native-sound');
  SoundPlayer = SoundModule?.default || SoundModule;
  if (SoundPlayer && SoundPlayer.setCategory) {
    SoundPlayer.setCategory('Playback', true);
  }
} catch (e) {
  console.log("react-native-sound missing");
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── ADMIN EMAILS ───
const KNOWN_ADMIN_EMAILS = [
  'jitendrakumar2k4@gmail.com',
  'codizumtech@gmail.com'
];

// ─── LOCAL ASSETS ───
const IMG_STREAK = require('../../../assets/streak.png');
const IMG_SMALL_TALK = require('../../../assets/small_talk.png');
const IMG_CHALLENGE = require('../../../assets/challnge.png');
const IMG_CALENDER_OBJECT = require('../../../assets/calender.png');

const AVATAR_COLORS = ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316', '#3B82F6', '#D946EF'];
const DURATION_OPTIONS = [15, 30, 45, 60];
const MAX_CHALLENGE_SECONDS = 60;

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

const toHindiName = (nameStr: string = '', lang: string = 'en') => {
  if (lang !== 'hi' || !nameStr) return nameStr;

  const nameMap: Record<string, string> = {
    'Saad Siddiqui': 'साद सिद्दीकी',
    'Saad': 'साद',
    'Jitendra Kumar': 'जितेन्द्र कुमार',
    'Jitendra': 'जितेन्द्र',
    'Aman Sharma': 'अमन शर्मा',
    'Aman': 'अमन',
    'Sneha Patel': 'स्नेहा पटेल',
    'Sneha': 'स्नेहा',
    'Rohit Verma': 'रोहित वर्मा',
    'Rohit': 'रोहित',
    'Priya': 'प्रिया',
    'Diego Ramos': 'डिएगो रामोस',
    'Diego': 'डिएगो',
    'User': 'यूजर',
    'Google User': 'गूगल यूजर',
    'Codizumtech': 'कोडिजमटेक'
  };

  if (nameMap[nameStr.trim()]) {
    return nameMap[nameStr.trim()];
  }

  let res = nameStr;
  res = res.replace(/Saad/gi, 'साद');
  res = res.replace(/Siddiqui/gi, 'सिद्दीकी');
  res = res.replace(/User/gi, 'यूजर');
  return res;
};

const SleepingZzzAnimation = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -12],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 5, 2],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.1],
  });

  return (
    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16 }}>😴</Text>
      <Animated.Text
        style={{
          position: 'absolute',
          top: -10,
          right: -10,
          fontSize: 10,
          fontWeight: '900',
          color: '#94A3B8',
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        }}
      >
        zzz...
      </Animated.Text>
    </View>
  );
};

const getStreakEmoji = (streakCount: number = 0) => {
  if (streakCount <= 0) return '😴'; 
  if (streakCount < 4) return '🔥';  
  if (streakCount < 7) return '⚡';  
  if (streakCount < 14) return '🚀'; 
  if (streakCount < 30) return '💥'; 
  return '👑';                         
};

const SEVEN_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const t = themeContext?.t;
  const currentLang = themeContext?.currentLang || 'en';

  const colors = themeContext?.theme?.colors || {
    primary: '#6366F1',
    bgLight: isDarkMode ? '#090D16' : '#F8FAFC',
    bgCard: isDarkMode ? '#131B2E' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    alertRed: '#EF4444',
    successGreen: '#10B981'
  };

  const currentUser = auth().currentUser;
  const currentEmailClean = (currentUser?.email || '').toLowerCase().trim();
  const isAdmin = KNOWN_ADMIN_EMAILS.includes(currentEmailClean);

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [greetingKey, setGreetingKey] = useState<'goodMorning' | 'goodAfternoon' | 'goodEvening'>('goodMorning');
  
  const [latestCommunityPost, setLatestCommunityPost] = useState<any>(null);
  
  // 📅 Streak Calendar States
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // 🎙️ TODAY'S CHALLENGE & REAL AUDIO RECORDING STATES
  const [isChallengeModalVisible, setIsChallengeModalVisible] = useState(false);
  const [dailyTopicData, setDailyTopicData] = useState<any>({
    title: 'Describe your favourite morning routine',
    subtitle: 'Daily speaking challenge',
    durationSec: 60,
    rewardXP: 10
  });

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isPausedAudio, setIsPausedAudio] = useState(false);
  const [localRecordedAudioUri, setLocalRecordedAudioUri] = useState<string | null>(null);
  const [isSavingAudio, setIsSavingAudio] = useState(false);

  // Firestore Saved Recordings (Privacy Layer)
  const [savedUserRecording, setSavedUserRecording] = useState<any>(null);
  const [allAdminRecordings, setAllAdminRecordings] = useState<any[]>([]);
  const [activePlayingUrl, setActivePlayingUrl] = useState<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<any>(null);
  const soundInstanceRef = useRef<any>(null);
  const elapsedRef = useRef(0);
  const durationLimitRef = useRef(MAX_CHALLENGE_SECONDS);

  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const borderShineAnim = useRef(new Animated.Value(0)).current;

  // Admin Topic Edit State
  const [isAdminEditTopicModal, setIsAdminEditTopicModal] = useState(false);
  const [adminNewTopicTitle, setAdminNewTopicTitle] = useState('');
  const [adminNewTopicSubtitle, setAdminNewTopicSubtitle] = useState('');
  const [adminSelectedDuration, setAdminSelectedDuration] = useState(60);

  useEffect(() => {
    Animated.loop(
      Animated.timing(borderShineAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [borderShineAnim]);

  useEffect(() => {
    if (isRecordingAudio && !isPausedAudio) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.18,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      micPulseAnim.setValue(1);
    }
  }, [isRecordingAudio, isPausedAudio]);

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 4 && currentHour < 12) {
      setGreetingKey('goodMorning');
    } else if (currentHour >= 12 && currentHour < 16) {
      setGreetingKey('goodAfternoon');
    } else {
      setGreetingKey('goodEvening');
    }

    if (currentUser) {
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .onSnapshot(
          (documentSnapshot: any) => {
            const data = documentSnapshot?.data ? documentSnapshot.data() : null;

            if (data) {
              setUserData(data);
            } else {
              setUserData({
                fullName: currentUser.displayName || 'User',
                streak: 0,
                speakingScore: 0,
                fluency: 0,
                completedLectureDates: []
              });
            }
            setLoading(false);
          },
          (error: any) => {
            console.error("Firestore error:", error);
            setLoading(false);
          }
        );

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // 🌟 Real-time Latest Community Post
  useEffect(() => {
    const unsubFeed = firestore()
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot((snapshot: any) => {
        if (snapshot && !snapshot.empty) {
          const doc = snapshot.docs[0];
          setLatestCommunityPost({ id: doc.id, ...doc.data() });
        } else {
          setLatestCommunityPost(null);
        }
      });

    return () => unsubFeed();
  }, []);

  // 🌟 Daily Challenge Topic Listener
  useEffect(() => {
    const unsubTopic = firestore()
      .collection('daily_challenges')
      .doc('today')
      .onSnapshot((doc: any) => {
        const data = doc?.data ? doc.data() : null;
        if (data) {
          setDailyTopicData(data);
          setAdminNewTopicTitle(data.title || '');
          setAdminNewTopicSubtitle(data.subtitle || '');
          const safeDuration = Math.min(Math.max(Number(data.durationSec) || MAX_CHALLENGE_SECONDS, 1), MAX_CHALLENGE_SECONDS);
          setAdminSelectedDuration(safeDuration);
          durationLimitRef.current = safeDuration;
          if (!localRecordedAudioUri && !isRecordingAudio) {
            setRemainingSeconds(safeDuration);
          }
        }
      });

    return () => unsubTopic();
  }, [localRecordedAudioUri, isRecordingAudio]);

  // 🔒 PERSISTENT AUDIO LISTENER (Client-side sorted: zero index issues)
  useEffect(() => {
    if (!currentUser) return;

    if (isAdmin) {
      const unsubAdmin = firestore()
        .collection('challenge_recordings')
        .onSnapshot((snapshot: any) => {
          if (snapshot && !snapshot.empty) {
            const list = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA;
            });
            setAllAdminRecordings(list);
          } else {
            setAllAdminRecordings([]);
          }
        }, (err: any) => console.log('Admin recordings sync err:', err));

      return () => unsubAdmin();
    } else {
      const unsubUser = firestore()
        .collection('challenge_recordings')
        .where('uid', '==', currentUser.uid)
        .onSnapshot((snapshot: any) => {
          if (snapshot && !snapshot.empty) {
            const docs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA;
            });
            setSavedUserRecording(docs[0]);
          } else {
            setSavedUserRecording(null);
          }
        }, (err: any) => console.log('User recording sync err:', err));

      return () => unsubUser();
    }
  }, [currentUser, isAdmin]);

  // Audio recording initialization
  useEffect(() => {
    try {
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: 'speaking_challenge.wav'
      };
      if (AudioRecord && AudioRecord.init) {
        AudioRecord.init(options);
      }
    } catch (e) {
      console.log('AudioRecord init error:', e);
    }

    return () => {
      stopRecordingTimer();
      stopAudioPlayback();
    };
  }, []);

  const stopRecordingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ⏱️ TIMER FUNCTION (CONTINUOUS BACKGROUND RUN ON PAUSE)
  const startRecordingTimer = () => {
    stopRecordingTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current = elapsedRef.current + 1;
      const currentElapsed = elapsedRef.current;
      const maxLimit = durationLimitRef.current;
      const left = Math.max(maxLimit - currentElapsed, 0);

      setElapsedSeconds(currentElapsed);
      setRemainingSeconds(left);

      if (left <= 0) {
        handleStopRecording();
      }
    }, 1000);
  };

  const requestAudioPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'ECC requires access to your microphone to record your speaking challenge.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  // 🎙️ START RECORDING
  const handleStartRecording = async () => {
    stopAudioPlayback();
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone access is required to record your voice.');
      return;
    }

    try {
      setLocalRecordedAudioUri(null);
      elapsedRef.current = 0;
      setElapsedSeconds(0);
      const maxLimit = Number(dailyTopicData?.durationSec) || MAX_CHALLENGE_SECONDS;
      durationLimitRef.current = Math.min(maxLimit, MAX_CHALLENGE_SECONDS);
      setRemainingSeconds(durationLimitRef.current);

      if (AudioRecord && AudioRecord.start) {
        AudioRecord.start();
      }

      setIsRecordingAudio(true);
      setIsPausedAudio(false);
      startRecordingTimer();
    } catch (e: any) {
      Alert.alert('Recording Error', e.message || 'Unable to start audio recording.');
    }
  };

  // ⏸️ PAUSE RECORDING (Timer runs continuously in background)
  const handlePauseRecording = () => {
    if (!isRecordingAudio || isPausedAudio) return;
    setIsPausedAudio(true);
  };

  // ▶️ RESUME RECORDING
  const handleResumeRecording = () => {
    if (!isRecordingAudio || !isPausedAudio) return;
    setIsPausedAudio(false);
  };

  // ⏹️ STOP RECORDING (Anytime at student's choice)
  const handleStopRecording = async () => {
    stopRecordingTimer();
    setIsRecordingAudio(false);
    setIsPausedAudio(false);

    try {
      if (AudioRecord && AudioRecord.stop) {
        const audioFile = await AudioRecord.stop();
        if (audioFile) {
          setLocalRecordedAudioUri(audioFile);
        }
      }
    } catch (e: any) {
      console.log('Stop recording error:', e);
    }
  };

  // 🗑️ DISCARD LOCAL DRAFT
  const handleDiscardLocalDraft = async () => {
    stopRecordingTimer();
    stopAudioPlayback();
    setIsRecordingAudio(false);
    setIsPausedAudio(false);
    setLocalRecordedAudioUri(null);
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setRemainingSeconds(durationLimitRef.current);

    try {
      if (AudioRecord && AudioRecord.stop) {
        await AudioRecord.stop();
      }
    } catch (e) {}
  };

  // 📤 SEND RESPONSE (FIXED [storage/object-not-found] ON BOTH PLATFORMS)
  const handleSaveRecordingPermanently = async () => {
    if (!localRecordedAudioUri) {
      Alert.alert('Recording Missing', 'Please record your response before sending.');
      return;
    }
    if (!currentUser) return;

    setIsSavingAudio(true);
    stopAudioPlayback();

    try {
      // Small sync tick to guarantee local audio file is fully written to disk
      await new Promise((resolve) => setTimeout(resolve, 250));

      const fileName = `challenge_${currentUser.uid}_${Date.now()}.wav`;
      const storagePath = `challenges_recordings/${currentUser.uid}/${fileName}`;
      const reference = storage().ref(storagePath);

      // Safe normalization for Android / iOS local file paths
      let uploadUri = localRecordedAudioUri;
      if (Platform.OS === 'android') {
        if (!uploadUri.startsWith('file://')) {
          uploadUri = `file://${uploadUri}`;
        }
      } else if (Platform.OS === 'ios') {
        uploadUri = uploadUri.replace('file://', '');
      }

      await reference.putFile(uploadUri);
      const downloadUrl = await reference.getDownloadURL();

      // Saved in challenge_recordings for User view & Admin dashboard
      await firestore().collection('challenge_recordings').add({
        challengeTitle: dailyTopicData.title,
        uid: currentUser.uid,
        studentName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
        userPhoto: currentUser.photoURL || null,
        audioUrl: downloadUrl,
        durationSeconds: elapsedSeconds || 1,
        createdAt: firestore.FieldValue.serverTimestamp()
      });

      // Increment User XP (+10 XP)
      await firestore().collection('users').doc(currentUser.uid).set({
        xp: firestore.FieldValue.increment(dailyTopicData.rewardXP || 10),
      }, { merge: true });

      setIsSavingAudio(false);
      setLocalRecordedAudioUri(null);
      Alert.alert('🎉 Sent Successfully!', 'Your speaking challenge response has been saved.');
    } catch (e: any) {
      setIsSavingAudio(false);
      console.log('Firebase storage upload error:', e);
      Alert.alert('Send Failed', e.message || 'Unable to upload recording. Please try again.');
    }
  };

  // 🗑️ DELETE RECORDING FROM FIRESTORE (USER / ADMIN ACCESS)
  const handleDeleteFirestoreRecording = (docId: string, audioUrl?: string) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recorded challenge response?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              stopAudioPlayback();
              await firestore().collection('challenge_recordings').doc(docId).delete();
              if (audioUrl) {
                try {
                  const ref = storage().refFromURL(audioUrl);
                  await ref.delete();
                } catch (e) {}
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete recording.');
            }
          }
        }
      ]
    );
  };

  // 🔊 AUDIO PLAYBACK (FOR LOCAL DRAFT AND CLOUD AUDIOS)
  const handleTogglePlayAudio = (audioTarget: string) => {
    if (!audioTarget) return;

    if (activePlayingUrl === audioTarget && soundInstanceRef.current) {
      soundInstanceRef.current.stop();
      soundInstanceRef.current.release();
      soundInstanceRef.current = null;
      setActivePlayingUrl(null);
      return;
    }

    if (!SoundPlayer) {
      Alert.alert('Playback Ready', 'Audio playback is supported on this device.');
      return;
    }

    stopAudioPlayback();

    const isHttp = audioTarget.startsWith('http');
    const basePath = isHttp ? undefined : '';

    const sound = new SoundPlayer(audioTarget, basePath, (error: any) => {
      if (error) {
        setActivePlayingUrl(null);
        return;
      }
      setActivePlayingUrl(audioTarget);
      sound.play((success: boolean) => {
        setActivePlayingUrl(null);
        sound.release();
      });
    });

    soundInstanceRef.current = sound;
  };

  const stopAudioPlayback = () => {
    if (soundInstanceRef.current) {
      try {
        soundInstanceRef.current.stop();
        soundInstanceRef.current.release();
      } catch (e) {}
      soundInstanceRef.current = null;
    }
    setActivePlayingUrl(null);
  };

  // ✏️ ADMIN TOPIC & TIME UPDATE
  const handleAdminSaveTopic = async () => {
    if (!adminNewTopicTitle.trim()) {
      Alert.alert('Validation', 'Please enter challenge topic prompt.');
      return;
    }
    try {
      const duration = Math.min(adminSelectedDuration, MAX_CHALLENGE_SECONDS);
      await firestore().collection('daily_challenges').doc('today').set({
        title: adminNewTopicTitle.trim(),
        subtitle: adminNewTopicSubtitle.trim() || `${duration}-second speaking challenge`,
        durationSec: duration,
        rewardXP: 10,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      setIsAdminEditTopicModal(false);
      Alert.alert('Success', `Daily topic updated with ${duration}s limit!`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openChallengeModal = () => {
    stopAudioPlayback();
    setIsChallengeModalVisible(true);
  };

  const closeChallengeModal = () => {
    stopAudioPlayback();
    if (isRecordingAudio) {
      handleStopRecording();
    }
    setIsChallengeModalVisible(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const rawFullDisplayName = userData?.fullName || currentUser?.displayName || 'User';
  const rawFirstName = rawFullDisplayName.split(' ')[0];
  const userFirstNameInHindi = toHindiName(rawFirstName, currentLang);
  const avatarInitials = rawFirstName.charAt(0).toUpperCase();
  const profilePhotoUrl = currentUser?.photoURL;

  const greetingText = t?.home?.[greetingKey] || 
    (greetingKey === 'goodMorning' ? 'Good morning,' : greetingKey === 'goodAfternoon' ? 'Good afternoon,' : 'Good evening,');

  const userStreak = typeof userData?.streak === 'number' ? userData.streak : 0;
  const longestStreak = userData?.longestStreak ?? userStreak;
  const bestStreak = userData?.bestStreak ?? userStreak;
  const streakEmoji = getStreakEmoji(userStreak);

  const cardBg = isDarkMode ? '#131C2E' : '#FFFFFF';
  const activeGlowBorder = colors.primary + (isDarkMode ? '55' : '33');

  const realToday = new Date();
  const todayIndex = realToday.getDay();

  // Dynamic Calendar Month Logic
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(calYear, calMonth, 0).getDate();

  const calendarCells: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthTotalDays - i,
      isCurrentMonth: false,
      dateStr: ''
    });
  }

  for (let i = 1; i <= totalDaysInMonth; i++) {
    const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarCells.push({
      day: i,
      isCurrentMonth: true,
      dateStr: dStr
    });
  }

  const totalGridCells = calendarCells.length > 35 ? 42 : 35;
  const remaining = totalGridCells - calendarCells.length;
  if (remaining > 0) {
    for (let i = 1; i <= remaining; i++) {
      calendarCells.push({
        day: i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }
  }

  const handleMonthChange = (dir: number) => {
    setCalendarDate(new Date(calYear, calMonth + dir, 1));
  };

  const isTodayDate = (d: number, isCur: boolean) => {
    return isCur && d === realToday.getDate() && calMonth === realToday.getMonth() && calYear === realToday.getFullYear();
  };

  const isStudyCompletedDay = (d: number, isCur: boolean) => {
    if (!isCur || !userStreak || userStreak <= 0) return false;
    const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (userData?.completedLectureDates && Array.isArray(userData.completedLectureDates)) {
      return userData.completedLectureDates.includes(dStr);
    }
    return false;
  };

  const isMissedPastDay = (d: number, isCur: boolean) => {
    if (!isCur) return false;
    const cellDate = new Date(calYear, calMonth, d);
    const todayZero = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate());
    const isPast = cellDate < todayZero;
    const isStudied = isStudyCompletedDay(d, isCur);
    return isPast && !isStudied;
  };

  const animatedBorderColor = borderShineAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#8B5CF6', '#38BDF8', '#8B5CF6']
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={false}
      />
      
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.bgLight }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        
        {/* 1. TOP HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Profile')}
              style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
            >
              {profilePhotoUrl ? (
                <Image 
                  source={{ uri: profilePhotoUrl }} 
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{avatarInitials}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.userTextContainer}>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]}>{greetingText}</Text>
              <Text style={[styles.userNameText, { color: colors.textPrimary }]}>{userFirstNameInHindi} 👋</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.notificationBtn, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={[styles.redDotBadge, { backgroundColor: colors.alertRed }]} />
          </TouchableOpacity>
        </View>

        {/* 2. STATS ROW (CLICK TO OPEN CALENDAR - FIXED OVAL PILL & BOLD LETTERS) */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.streakCardContainer}
            activeOpacity={0.9}
            onPress={() => setIsCalendarVisible(true)}
          >
            <Image 
              source={IMG_STREAK} 
              style={styles.absoluteBackgroundCrop}
              resizeMode="cover"
            />
            
            <View style={styles.streakOverlay}>
              <View style={styles.streakTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.streakEmojiCircle}>
                    {userStreak <= 0 ? (
                      <SleepingZzzAnimation />
                    ) : (
                      <Text style={{ fontSize: 16 }}>{streakEmoji}</Text>
                    )}
                  </View>
                  <Text style={styles.streakLabelText}>{t?.home?.streak || 'Streak'}</Text>
                </View>
                
                <View style={styles.calendarCircle}>
                  <Calendar size={13} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>

              <Text style={styles.streakNumberText}>{userStreak}</Text>
              <Text style={styles.streakDaysSubText}>{t?.home?.daysInRow || 'Days in a row'}</Text>

              {/* 🌟 7 DAYS ROW WITH ORIGINAL OVAL PILL & BOLD LETTERS */}
              <View style={styles.streakDaysRow}>
                {SEVEN_DAYS.map((letter, idx) => {
                  const isToday = idx === todayIndex;
                  const isDayStudied = userStreak > 0 && idx < todayIndex && userStreak > (todayIndex - idx - 1);
                  return (
                    <View 
                      key={idx} 
                      style={[
                        styles.dayColumn,
                        isToday && styles.todayActiveCirclePill
                      ]}
                    >
                      <Text style={[
                        styles.dayLetterText, 
                        isToday && { color: '#FFFFFF', fontWeight: '900' }
                      ]}>
                        {letter}
                      </Text>
                      <View style={[
                        styles.dayDot, 
                        isToday 
                          ? { backgroundColor: '#FFFFFF', width: 5, height: 5 } 
                          : (isDayStudied ? { backgroundColor: '#F59E0B' } : { backgroundColor: 'rgba(255,255,255,0.45)' })
                      ]} />
                    </View>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.ringsColumn}>
            <View style={[styles.ringMiniCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
              <View style={[styles.scoreBadgeCircle, { backgroundColor: colors.primary + '1F' }]}>
                <Text style={[styles.scoreValueText, { color: colors.primary }]}>
                  {userData?.speakingScore ?? 0}
                </Text>
              </View>
              <View style={styles.ringInfoTextContainer}>
                <Text style={[styles.ringTitle, { color: colors.textPrimary }]}>
                  {t?.home?.speaking || 'Speaking'}
                </Text>
                <Text style={[styles.ringSubtitle, { color: colors.textSecondary }]}>
                  {t?.home?.thisWeek || '+4 this week'}
                </Text>
              </View>
            </View>

            <View style={[styles.ringMiniCard, { backgroundColor: cardBg, borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
              <View style={[styles.scoreBadgeCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.scoreValueText, { color: '#10B981' }]}>
                  {userData?.fluency ?? 0}
                </Text>
              </View>
              <View style={styles.ringInfoTextContainer}>
                <Text style={[styles.ringTitle, { color: colors.textPrimary }]}>
                  {t?.home?.fluency || 'Fluency'}
                </Text>
                <Text style={[styles.ringSubtitle, { color: colors.textSecondary }]}>
                  {t?.home?.level || 'Level B2'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. HERO LIVE ROOM CARD */}
        <View style={styles.heroCardContainer}>
          <View style={styles.bannerCardWrapper}>
            <Image 
              source={IMG_SMALL_TALK} 
              style={styles.absoluteBackgroundCrop}
              resizeMode="cover"
            />
            
            <View style={styles.liveHeroCardContent}>
              <View style={styles.liveBadge}>
                <View style={styles.liveBadgeDot} />
                <Text style={styles.liveBadgeText}>{t?.home?.liveNow || 'LIVE NOW'}</Text>
              </View>

              <Text style={styles.heroCardTitle}>
                {t?.home?.morningTalk || 'Morning Small Talk'} 👋
              </Text>
              <Text style={styles.heroCardDesc}>
                {t?.home?.casualConv || 'Great conversations start your day'}
              </Text>

              <View style={styles.heroFooterRow}>
                <View style={styles.heroAvatarStack}>
                  <View style={[styles.stackAvatar, { backgroundColor: '#3B82F6', marginLeft: 0 }]}><Text style={styles.stackAvatarText}>AK</Text></View>
                  <View style={[styles.stackAvatar, { backgroundColor: '#F59E0B' }]}><Text style={styles.stackAvatarText}>YT</Text></View>
                  <View style={[styles.stackAvatar, { backgroundColor: '#60A5FA' }]}><Text style={styles.stackAvatarText}>OF</Text></View>
                  <View style={[styles.stackAvatar, { backgroundColor: '#A78BFA' }]}><Text style={styles.stackAvatarText}>DR</Text></View>
                  <View style={[styles.stackAvatarCount]}><Text style={styles.stackAvatarCountText}>+24</Text></View>
                </View>

                <TouchableOpacity 
                  style={styles.heroJoinButton} 
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('VoiceRooms')}
                >
                  <Text style={[styles.heroJoinBtnText, { color: '#6366F1' }]}>
                    {t?.home?.joinRoom || 'Join room →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* 4. TODAY'S CHALLENGE CARD (HYPER-PREMIUM NEON GLOW & VIBRANT TOPIC) */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.home?.todayChallenge || "Today's Challenge"}
        </Text>
        
        <TouchableOpacity 
          style={styles.uniqueChallengeOuter} 
          activeOpacity={0.92}
          onPress={openChallengeModal}
        >
          <Animated.View style={[styles.challengeGlowAura, { borderColor: animatedBorderColor }]} />

          <View style={styles.challengeBannerWrapper}>
            <Image 
              source={IMG_CHALLENGE} 
              style={styles.absoluteBackgroundCrop}
              resizeMode="cover"
            />

            <View style={styles.challengeClickOverlay}>
              <View style={styles.challengeLeftContent}>
                <View style={styles.challengeTopTagRow}>
                  <Sparkles size={12} color="#F59E0B" />
                  <Text style={styles.challengeLabelTag}>Today's Challenge</Text>
                </View>

                <Text style={styles.challengeMainTitleBold} numberOfLines={2}>
                  {dailyTopicData?.title || 'Describe your daily morning routine...'}
                </Text>
                
                <Text style={styles.challengeSubTitle}>
                  {dailyTopicData?.subtitle || 'Record voice & send'}
                </Text>
                
                <View style={styles.challengeStatsRow}>
                  <View style={styles.challengeXpBadge}>
                    <Text style={styles.challengeXpText}>★ +{dailyTopicData?.rewardXP || 10} XP</Text>
                  </View>
                  <Text style={styles.challengeDurationText}>⏱️ {dailyTopicData?.durationSec || 60}s</Text>
                  
                  {savedUserRecording && !isAdmin && (
                    <View style={styles.draftSavedTag}>
                      <Check size={11} color="#10B981" strokeWidth={3} />
                      <Text style={styles.draftSavedTagText}>Saved</Text>
                    </View>
                  )}

                  {isAdmin && allAdminRecordings.length > 0 && (
                    <View style={styles.adminCountTag}>
                      <Headphones size={11} color="#C084FC" strokeWidth={2.5} />
                      <Text style={styles.adminCountTagText}>{allAdminRecordings.length} Submissions</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.challengeArrowPill}>
                <ChevronRight size={17} color="#FFFFFF" strokeWidth={3.8} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 5. UPCOMING SESSIONS */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>
            {t?.home?.upcomingSessions || 'Upcoming Sessions'}
          </Text>
          <View>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              {t?.home?.seeAll || 'See all'}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollWrapper}>
          <View style={[styles.upcomingSessionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
            <View style={[styles.sessionHeaderPill, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.sessionTimeText, { color: colors.primary }]}>
                {t?.home?.todayTime1 || '📅 Today, 6:00 PM'}
              </Text>
            </View>
            <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>
              {t?.home?.session1Title || '1:1 with Priya'}
            </Text>
            <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
              {t?.home?.session1Desc || 'IELTS Speaking coaching'}
            </Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: '#22C55E' }]}><Text style={styles.initialsText}>PN</Text></View>
              <Text style={[styles.sessionDurationText, { color: colors.textSecondary }]}>
                {t?.home?.session1Details || '30 min • Video'}
              </Text>
            </View>
          </View>

          <View style={[styles.upcomingSessionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
            <View style={[styles.sessionHeaderPill, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.sessionTimeText, { color: colors.primary }]}>
                {t?.home?.todayTime2 || '🎙️ Today, 7:30 PM'}
              </Text>
            </View>
            <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>
              {t?.home?.session2Title || 'Debate Club'}
            </Text>
            <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
              {t?.home?.session2Desc || 'Technology & Society'}
            </Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: colors.primary }]}><Text style={styles.initialsText}>DR</Text></View>
              <Text style={[styles.sessionDurationText, { color: colors.textSecondary }]}>
                {t?.home?.session2Details || '45 min • Audio'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* 🌟 6. UNIQUE ULTRA-PREMIUM 'FROM THE COMMUNITY' CARD */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>
            {t?.home?.fromCommunity || 'From the Community'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Community')} activeOpacity={0.7}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              {t?.home?.seeAll || 'See all'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.uniqueCommunityCardOuter}
          onPress={() => navigation.navigate('Community')}
          activeOpacity={0.92}
        >
          <Animated.View style={[styles.communityCardGlowAura, { borderColor: animatedBorderColor }]} />

          <View style={[styles.communityPostCardUnique, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' }]}>
            
            <View style={styles.postUserRow}>
              <View style={[styles.postUserAvatarUnique, { backgroundColor: getAvatarColor(latestCommunityPost?.userName || 'User') }]}>
                <Text style={styles.postAvatarTextUnique}>{(latestCommunityPost?.userName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.postUserInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.postUserNameUnique, { color: colors.textPrimary }]}>
                    {toHindiName(latestCommunityPost?.userName || 'Diego Ramos', currentLang)}
                  </Text>
                  <Sparkles size={13} color="#F59E0B" />
                </View>
                <Text style={[styles.postTimeTextUnique, { color: colors.textSecondary }]}>
                  {formatTimeAgo(latestCommunityPost?.createdAt)}
                </Text>
              </View>
              
              <View style={styles.communityLivePulsePill}>
                <Radio size={12} color="#10B981" strokeWidth={2.8} />
                <Text style={styles.communityLiveText}>Live Feed</Text>
              </View>
            </View>

            <Text style={[styles.postContentTextUnique, { color: colors.textPrimary }]} numberOfLines={3}>
              {latestCommunityPost?.text || 'Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 7. RECENT ACTIVITY LIST */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.home?.recentActivity || 'Recent Activity'}
        </Text>
        <View style={styles.recentActivityContainer}>
          <View style={[styles.activityItemRow, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
            <View style={[styles.activityIconWrapper, { backgroundColor: colors.primary + '1F' }]}><Text style={styles.actIcon}>🎙️</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={[styles.activityTitleText, { color: colors.textPrimary }]}>
                {t?.home?.act1Title || "Joined 'Morning Small Talk'"}
              </Text>
              <Text style={[styles.activityTimeTextOffset, { color: colors.textSecondary }]}>
                {t?.home?.act1Time || '2h ago'}
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* ─── 🎙️ CHALLENGE CARD MODAL (SEND RESPONSE & PRIVACY LAYER) ─── */}
      <Modal
        visible={isChallengeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeChallengeModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeChallengeModal}
        >
          <TouchableOpacity 
            activeOpacity={1}
            style={[styles.challengeModalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            
            <View style={styles.challengeModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Award size={22} color="#F59E0B" />
                <Text style={[styles.challengeModalMainTitle, { color: colors.textPrimary }]}>Daily Speaking Challenge</Text>
              </View>
              <TouchableOpacity onPress={closeChallengeModal} style={styles.closeRoundBtn}>
                <X size={18} color="#94A3B8" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Daily Topic Box with Vibrant Bold Accent */}
              <View style={[styles.challengeTopicBox, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '33' }]}>
                <Text style={[styles.challengeTopicTextBold, { color: colors.primary }]}>
                  "{dailyTopicData?.title}"
                </Text>
                <Text style={[styles.challengeTopicSub, { color: colors.textSecondary }]}>
                  {dailyTopicData?.subtitle} • Record your answer. Only you & admin have access to this audio.
                </Text>

                {isAdmin && (
                  <TouchableOpacity 
                    style={styles.adminEditTopicTrigger}
                    onPress={() => setIsAdminEditTopicModal(true)}
                  >
                    <Edit3 size={14} color="#8B5CF6" />
                    <Text style={styles.adminEditTopicTriggerText}>Admin: Change Topic & Time</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ⏱️ REAL-TIME RECORDING BANNER */}
              {isRecordingAudio && (
                <View style={styles.liveListeningBanner}>
                  <View style={[styles.liveAudioWaveDot, isPausedAudio && { backgroundColor: '#F59E0B' }]} />
                  <Volume2 size={16} color={isPausedAudio ? '#F59E0B' : '#EF4444'} />
                  <Text style={[styles.liveListeningText, isPausedAudio && { color: '#F59E0B' }]}>
                    {isPausedAudio ? `Paused (Mic paused, timer running: ${elapsedSeconds}s)` : `Recording audio... (${remainingSeconds}s remaining)`}
                  </Text>
                </View>
              )}

              {/* 🎧 SECTION 1: FRESH LOCAL RECORDING DRAFT (BEFORE SENDING) */}
              {localRecordedAudioUri && (
                <View style={[styles.audioStatusCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: '#10B981' }]}>
                  <View style={styles.previewAudioRow}>
                    <TouchableOpacity 
                      style={[styles.playPreviewBtn, { backgroundColor: activePlayingUrl === localRecordedAudioUri ? '#EF4444' : '#10B981' }]} 
                      onPress={() => handleTogglePlayAudio(localRecordedAudioUri)}
                    >
                      {activePlayingUrl === localRecordedAudioUri ? <Pause size={18} color="#FFFFFF" /> : <Play size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.previewAudioTitle, { color: colors.textPrimary }]}>Draft Recording Ready</Text>
                      <Text style={[styles.previewAudioSub, { color: colors.textSecondary }]}>Recorded {elapsedSeconds}s • Tap Send Response to save</Text>
                    </View>
                    <TouchableOpacity style={styles.deleteAudioBtn} onPress={handleDiscardLocalDraft}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 🎧 SECTION 2: SAVED USER AUDIO (PERSISTENT & PRIVATE TO THIS STUDENT) */}
              {!isAdmin && savedUserRecording && (
                <View style={[styles.audioStatusCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.primary + '55', marginTop: 6 }]}>
                  <View style={styles.previewAudioRow}>
                    <TouchableOpacity 
                      style={[styles.playPreviewBtn, { backgroundColor: activePlayingUrl === savedUserRecording.audioUrl ? '#EF4444' : colors.primary }]} 
                      onPress={() => handleTogglePlayAudio(savedUserRecording.audioUrl)}
                    >
                      {activePlayingUrl === savedUserRecording.audioUrl ? <Pause size={18} color="#FFFFFF" /> : <Play size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.previewAudioTitle, { color: colors.textPrimary }]}>Your Saved Recording</Text>
                      <Text style={[styles.previewAudioSub, { color: colors.textSecondary }]}>{savedUserRecording.durationSeconds}s duration • {formatTimeAgo(savedUserRecording.createdAt)}</Text>
                    </View>
                    <TouchableOpacity style={styles.deleteAudioBtn} onPress={() => handleDeleteFirestoreRecording(savedUserRecording.id, savedUserRecording.audioUrl)}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 👑 SECTION 3: ADMIN ACCESS TO ALL USER RECORDINGS */}
              {isAdmin && (
                <View style={styles.adminSubmissionsContainer}>
                  <Text style={[styles.adminSubmissionsHeading, { color: colors.textPrimary }]}>
                    All Student Submissions ({allAdminRecordings.length})
                  </Text>
                  {allAdminRecordings.length === 0 ? (
                    <Text style={[styles.audioEmptyHint, { color: colors.textSecondary, marginVertical: 10 }]}>No student has recorded this challenge yet.</Text>
                  ) : (
                    allAdminRecordings.map((item) => (
                      <View key={item.id} style={[styles.adminAudioItemCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
                        <TouchableOpacity 
                          style={[styles.playPreviewMiniBtn, { backgroundColor: activePlayingUrl === item.audioUrl ? '#EF4444' : colors.primary }]} 
                          onPress={() => handleTogglePlayAudio(item.audioUrl)}
                        >
                          {activePlayingUrl === item.audioUrl ? <Pause size={14} color="#FFFFFF" /> : <Play size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.adminAudioStudentName, { color: colors.textPrimary }]}>{item.studentName || item.userName || 'Learner'}</Text>
                          <Text style={[styles.adminAudioStudentSub, { color: colors.textSecondary }]}>{item.durationSeconds}s • {formatTimeAgo(item.createdAt)}</Text>
                        </View>
                        <TouchableOpacity style={styles.deleteAudioBtn} onPress={() => handleDeleteFirestoreRecording(item.id, item.audioUrl)}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* 🎙️ RECORDING CONTROL ACTIONS */}
              <View style={styles.micActionContainer}>
                {!localRecordedAudioUri && (
                  <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
                    <TouchableOpacity 
                      style={[
                        styles.micBigButton, 
                        { backgroundColor: isRecordingAudio ? (isPausedAudio ? '#F59E0B' : '#EF4444') : colors.primary }
                      ]}
                      onPress={isRecordingAudio ? handleStopRecording : handleStartRecording}
                      activeOpacity={0.85}
                    >
                      {isRecordingAudio ? (
                        <Square size={28} color="#FFFFFF" />
                      ) : (
                        <Mic size={32} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* PAUSE / RESUME / COMPLETE / RESET CONTROLS */}
                {isRecordingAudio && (
                  <View style={styles.speechControlRow}>
                    {!isPausedAudio ? (
                      <TouchableOpacity style={styles.pauseSpeechBtn} onPress={handlePauseRecording} activeOpacity={0.85}>
                        <Pause size={14} color="#F59E0B" style={{ marginRight: 4 }} />
                        <Text style={styles.pauseSpeechBtnText}>Pause</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.resumeSpeechBtn} onPress={handleResumeRecording} activeOpacity={0.85}>
                        <Play size={14} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={styles.resumeSpeechBtnText}>Resume</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.stopSpeechBtn} onPress={handleStopRecording} activeOpacity={0.85}>
                      <Square size={14} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={styles.stopSpeechBtnText}>Complete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.resetSpeechBtn} onPress={handleDiscardLocalDraft} activeOpacity={0.85}>
                      <RotateCcw size={14} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.resetSpeechBtnText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.micStatusLabel, { color: colors.textSecondary }]}>
                  {isRecordingAudio
                    ? `Speaking (${elapsedSeconds}s / ${dailyTopicData?.durationSec || 60}s) • Tap Complete when done`
                    : localRecordedAudioUri
                      ? `Audio draft ready (${elapsedSeconds}s) • Tap Send Response to save`
                      : `Max duration: ${dailyTopicData?.durationSec || 60}s (Speak any length)`}
                </Text>
              </View>

              {/* 📤 SEND RESPONSE BUTTON */}
              <TouchableOpacity 
                style={[
                  styles.sendResponseBtn, 
                  { backgroundColor: localRecordedAudioUri ? '#10B981' : (isDarkMode ? '#334155' : '#CBD5E1') }
                ]}
                disabled={!localRecordedAudioUri || isSavingAudio}
                onPress={handleSaveRecordingPermanently}
                activeOpacity={0.88}
              >
                {isSavingAudio ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={[styles.sendResponseBtnText, !localRecordedAudioUri && { color: '#94A3B8' }]}>
                      Send Response (+10 XP)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── ✏️ ADMIN EDIT TOPIC & DURATION MODAL (OUTSIDE TAP TO CLOSE) ─── */}
      <Modal
        visible={isAdminEditTopicModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsAdminEditTopicModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAdminEditTopicModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            style={[styles.adminEditCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.adminEditTitle, { color: colors.textPrimary }]}>Admin: Update Daily Challenge</Text>
            
            <Text style={[styles.inputFieldLabel, { color: colors.textSecondary }]}>Challenge Topic / Prompt</Text>
            <TextInput 
              style={[styles.adminInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}
              placeholder="e.g. Describe your dream travel destination"
              placeholderTextColor={colors.textSecondary}
              value={adminNewTopicTitle}
              onChangeText={setAdminNewTopicTitle}
              multiline
            />

            <Text style={[styles.inputFieldLabel, { color: colors.textSecondary }]}>Subtitle</Text>
            <TextInput 
              style={[styles.adminInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}
              placeholder="e.g. Daily speaking challenge"
              placeholderTextColor={colors.textSecondary}
              value={adminNewTopicSubtitle}
              onChangeText={setAdminNewTopicSubtitle}
            />

            <Text style={[styles.inputFieldLabel, { color: colors.textSecondary }]}>Time Limit (Seconds)</Text>
            <View style={styles.durationSelectorRow}>
              {DURATION_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.durationChip,
                    adminSelectedDuration === sec && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setAdminSelectedDuration(sec)}
                >
                  <Text style={[
                    styles.durationChipText,
                    { color: colors.textPrimary },
                    adminSelectedDuration === sec && { color: '#FFFFFF', fontWeight: '900' }
                  ]}>
                    {sec}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.adminActionRow}>
              <TouchableOpacity 
                style={[styles.adminCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} 
                onPress={() => setIsAdminEditTopicModal(false)}
              >
                <Text style={[styles.adminCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminSaveBtn} onPress={handleAdminSaveTopic}>
                <Text style={styles.adminSaveBtnText}>Save Topic</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── 📅 STREAK CALENDAR MODAL ─── */}
      <Modal
        visible={isCalendarVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCalendarVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.modalCardContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTitleGroup}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <Text style={styles.headerTitle}>Streak Calendar</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setIsCalendarVisible(false)} 
                activeOpacity={0.7}
              >
                <X size={18} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>

            <View style={styles.streakHeroBanner}>
              <View style={styles.streakLeftInfo}>
                <View style={styles.streakNumberRow}>
                  <Text style={styles.streakBigNumber}>{userStreak}</Text>
                  <Text style={styles.daysInRowText}>days in a row</Text>
                </View>

                <View style={styles.streakStatusPill}>
                  <Text style={styles.streakStatusText}>
                    {userStreak > 0 ? 'Keep it up! 🔥' : 'Start your streak! 🎯'}
                  </Text>
                </View>
              </View>

              <View style={styles.artContainer}>
                <Image
                  source={IMG_CALENDER_OBJECT}
                  style={styles.calenderObjectImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.monthControlRow}>
              <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.navArrowBtn}>
                <ChevronLeft size={22} color="#C084FC" strokeWidth={3} />
              </TouchableOpacity>
              <Text style={styles.monthTitleText}>
                {MONTH_NAMES[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.navArrowBtn}>
                <ChevronRight size={22} color="#C084FC" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <View style={styles.daysHeaderRow}>
              {SEVEN_DAYS.map((d, index) => {
                const isCurrentDayHeader = index === todayIndex;
                return (
                  <View 
                    key={index}
                    style={[
                      styles.dayHeaderCell,
                      isCurrentDayHeader && styles.todayHeaderCellCircle
                    ]}
                  >
                    <Text style={[
                      styles.weekDayText,
                      isCurrentDayHeader && styles.todayHeaderTextActive
                    ]}>
                      {d}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.gridContainer}>
              {calendarCells.map((item, index) => {
                const active = isStudyCompletedDay(item.day, item.isCurrentMonth);
                const missed = isMissedPastDay(item.day, item.isCurrentMonth);
                const todayMark = isTodayDate(item.day, item.isCurrentMonth);

                return (
                  <View key={index} style={styles.cellWrapper}>
                    {active ? (
                      <View style={styles.activeCheckCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3.5} />
                      </View>
                    ) : todayMark ? (
                      <View style={styles.targetTodayCircle}>
                        <Text style={styles.targetTodayText}>{item.day}</Text>
                      </View>
                    ) : missed ? (
                      <View style={styles.premiumCrossCircle}>
                        <Text style={styles.crossIconText}>✕</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.dateNumberText,
                          !item.isCurrentMonth && styles.mutedDateText,
                        ]}
                      >
                        {item.day}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.bottomStatsCard}>
              <View style={styles.statItemRow}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Longest streak</Text>
                  <Text style={styles.statValue}>{longestStreak} days</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.5} />
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItemRow}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Best streak</Text>
                  <Text style={styles.statValue}>{bestStreak} days</Text>
                </View>
                <TouchableOpacity style={styles.viewStatsAction}>
                  <Text style={styles.viewStatsActionText}>📊 View stats</Text>
                  <ChevronRight size={16} color="#C084FC" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginTop: 15, 
    paddingBottom: 15 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    overflow: 'hidden' 
  },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  userTextContainer: { marginLeft: 12 },
  greetingText: { fontSize: 13, fontWeight: '700' },
  userNameText: { fontSize: 22, fontWeight: '900', marginTop: 1 },
  notificationBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1.5 
  },
  bellIcon: { fontSize: 18 },
  redDotBadge: { position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4 },

  statsRow: { 
    flexDirection: 'row', 
    paddingHorizontal: 20, 
    justifyContent: 'space-between', 
    marginTop: 6 
  },
  
  streakCardContainer: { 
    width: (SCREEN_WIDTH - 55) * 0.52, 
    height: 156,
    borderRadius: 24, 
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3730A3',
    elevation: 4,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  absoluteBackgroundCrop: {
    position: 'absolute',
    top: '-7%',
    left: '-7%',
    width: '114%',
    height: '114%',
  },
  streakOverlay: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between'
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  streakEmojiCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  streakLabelText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900'
  },
  calendarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  streakNumberText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1
  },
  streakDaysSubText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: -2
  },
  streakDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  /* 🌟 FIXED: OVAL PILL SHAPE */
  dayColumn: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
  },
  todayActiveCirclePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  dayLetterText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
  },

  ringsColumn: { 
    width: (SCREEN_WIDTH - 55) * 0.45, 
    justifyContent: 'space-between' 
  },
  ringMiniCard: { 
    borderRadius: 24, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    height: 74, 
    borderWidth: 1.5 
  },
  scoreBadgeCircle: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  scoreValueText: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  ringInfoTextContainer: { flex: 1 },
  ringTitle: { fontSize: 13.5, fontWeight: '900' },
  ringSubtitle: { fontSize: 11, marginTop: 2, fontWeight: '700' },

  heroCardContainer: { 
    marginHorizontal: 20, 
    marginTop: 20 
  },
  bannerCardWrapper: {
    width: '100%',
    minHeight: 165,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  liveHeroCardContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between'
  },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 10,
    alignSelf: 'flex-start'
  },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroCardTitle: { fontSize: 21, fontWeight: '900', color: '#FFFFFF', marginTop: 10 },
  heroCardDesc: { fontSize: 12.5, color: 'rgba(255, 255, 255, 0.9)', marginTop: 3, fontWeight: '700' },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  heroAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, marginLeft: -8, borderWidth: 1.5, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  stackAvatarText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  stackAvatarCount: { width: 28, height: 28, borderRadius: 14, marginLeft: -8, backgroundColor: '#6366F1', borderWidth: 1.5, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  stackAvatarCountText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  heroJoinButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  heroJoinBtnText: { fontWeight: '900', fontSize: 12 },

  /* 🌟 UNIQUE CHALLENGE GLOW CARD STYLES */
  uniqueChallengeOuter: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 28,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  challengeGlowAura: {
    position: 'absolute',
    top: -2.5,
    left: -2.5,
    right: -2.5,
    bottom: -2.5,
    borderRadius: 30,
    borderWidth: 2.5,
    zIndex: 2,
  },
  challengeBannerWrapper: {
    width: '100%',
    minHeight: 128,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  challengeClickOverlay: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  challengeLeftContent: {
    flex: 1,
    paddingLeft: 62,
    paddingRight: 10
  },
  challengeTopTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  challengeLabelTag: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  challengeMainTitleBold: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  challengeSubTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2
  },
  challengeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  challengeXpBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  challengeXpText: {
    color: '#F59E0B',
    fontSize: 10.5,
    fontWeight: '900'
  },
  challengeDurationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  draftSavedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  draftSavedTagText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
  },
  adminCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderWidth: 1,
    borderColor: '#C084FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminCountTagText: {
    color: '#E9D5FF',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeArrowPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 2
  },

  sectionHeading: { fontSize: 19, fontWeight: '900', marginLeft: 20, marginTop: 22, letterSpacing: -0.2 },
  sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 22 },
  sectionHeadingMarginless: { fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  seeAllText: { fontSize: 13.5, fontWeight: '800' },
  horizontalScrollWrapper: { paddingLeft: 20, marginTop: 12 },
  upcomingSessionCard: { width: SCREEN_WIDTH * 0.68, marginRight: 16, padding: 18, borderRadius: 26, borderWidth: 1.5 },
  sessionHeaderPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sessionTimeText: { fontSize: 11.5, fontWeight: '900' },
  sessionMainTitle: { fontSize: 16, fontWeight: '900', marginTop: 10 },
  sessionDescText: { fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  sessionFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  sessionInitialsCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  initialsText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  sessionDurationText: { fontSize: 12, fontWeight: '700' },

  uniqueCommunityCardOuter: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 28,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  communityCardGlowAura: {
    position: 'absolute',
    top: -2.5,
    left: -2.5,
    right: -2.5,
    bottom: -2.5,
    borderRadius: 30,
    borderWidth: 2.5,
    zIndex: 2,
  },
  communityPostCardUnique: {
    margin: 2,
    borderRadius: 26,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  postUserRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  postUserAvatarUnique: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  postAvatarTextUnique: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '900' 
  },
  postUserInfo: { 
    flex: 1 
  },
  postUserNameUnique: { 
    fontSize: 16, 
    fontWeight: '900', 
    letterSpacing: -0.2 
  },
  postTimeTextUnique: { 
    fontSize: 11.5, 
    marginTop: 2, 
    fontWeight: '700' 
  },
  communityLivePulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  communityLiveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  postContentTextUnique: { 
    fontSize: 14, 
    marginTop: 14, 
    lineHeight: 21, 
    fontWeight: '700' 
  },

  recentActivityContainer: { paddingHorizontal: 20, marginTop: 8 },
  activityItemRow: { flexDirection: 'row', padding: 16, borderRadius: 24, alignItems: 'center', marginTop: 10, borderWidth: 1.5 },
  activityIconWrapper: { width: 42, height: 42, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  actIcon: { fontSize: 18 },
  activityMainDetails: { flex: 1 },
  activityTitleText: { fontSize: 14.5, fontWeight: '900' },
  activityTimeTextOffset: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCardContainer: {
    width: Math.min(SCREEN_WIDTH * 0.92, 380),
    borderRadius: 28,
    backgroundColor: '#0F0E1E',
    borderWidth: 1.2,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    elevation: 20,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakHeroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    minHeight: 105,
  },
  streakLeftInfo: {
    flex: 1,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  streakBigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: -1,
  },
  daysInRowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  streakStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  streakStatusText: {
    color: '#E9D5FF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  artContainer: {
    width: 120,
    height: 105,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calenderObjectImage: {
    width: '100%',
    height: '100%',
  },
  monthControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    padding: 6,
  },
  monthTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  dayHeaderCell: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  todayHeaderCellCircle: {
    backgroundColor: 'rgba(192, 132, 252, 0.25)',
    borderWidth: 1.8,
    borderColor: '#C084FC',
  },
  weekDayText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  todayHeaderTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  cellWrapper: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dateNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mutedDateText: {
    color: '#475569',
    fontWeight: '700',
  },
  activeCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7E22CE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumCrossCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossIconText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '900',
  },
  targetTodayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.2,
    borderColor: '#C084FC',
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetTodayText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },
  bottomStatsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: '#CBD5E1',
    fontSize: 12.5,
    fontWeight: '700',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  statDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  viewStatsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewStatsActionText: {
    color: '#C084FC',
    fontSize: 12.5,
    fontWeight: '900',
  },

  /* ─── 🎙️ TODAY'S CHALLENGE MODAL STYLES ─── */
  challengeModalCard: {
    width: Math.min(SCREEN_WIDTH * 0.92, 390),
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    maxHeight: '85%',
  },
  challengeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  challengeModalMainTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTopicBox: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  challengeTopicTextBold: {
    fontSize: 16.5,
    fontWeight: '900',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  challengeTopicSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 17,
  },
  adminEditTopicTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  adminEditTopicTriggerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  liveListeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  liveAudioWaveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveListeningText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },
  audioStatusCard: {
    minHeight: 85,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    justifyContent: 'center',
  },
  audioEmptyHint: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  previewAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playPreviewBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  previewAudioTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  previewAudioSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteAudioBtn: {
    padding: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  adminSubmissionsContainer: {
    marginTop: 10,
    marginBottom: 14,
  },
  adminSubmissionsHeading: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  adminAudioItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  playPreviewMiniBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAudioStudentName: {
    fontSize: 13,
    fontWeight: '800',
  },
  adminAudioStudentSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  micActionContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  micBigButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  micStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  speechControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  pauseSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pauseSpeechBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
  },
  resumeSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resumeSpeechBtnText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '900',
  },
  stopSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  stopSpeechBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '900',
  },
  resetSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetSpeechBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  sendResponseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  sendResponseBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
  },

  /* ─── ✏️ ADMIN EDIT TOPIC MODAL STYLES ─── */
  adminEditCard: {
    width: Math.min(SCREEN_WIDTH * 0.9, 360),
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
  },
  adminEditTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  adminInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    marginBottom: 8,
  },
  durationSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  adminCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  adminSaveBtn: {
    flex: 1.2,
    backgroundColor: '#8B5CF6',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});