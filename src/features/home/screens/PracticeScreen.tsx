import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform, 
  ActivityIndicator, 
  Modal, 
  Alert, 
  Dimensions, 
  PermissionsAndroid, 
  Animated, 
  Easing, 
  Image 
} from 'react-native';
import { 
  ArrowRight, 
  Sparkles, 
  BookOpen, 
  Calendar, 
  Mic, 
  Volume2, 
  X, 
  Play, 
  Pause, 
  CheckCircle, 
  RotateCcw, 
  Clock, 
  Trash2, 
  Headphones, 
  Flame, 
  Zap, 
  Target, 
  ChevronRight, 
  Radio, 
  Sliders, 
  Check, 
  TrendingUp 
} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AudioRecord from 'react-native-audio-record';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🌟 Import XpRewardModal from the same screens folder
import XpRewardModal from './XpRewardModal';

let SoundPlayer: any = null;
try {
  const SoundModule = require('react-native-sound');
  SoundPlayer = SoundModule.default ? SoundModule.default : SoundModule;
  if (SoundPlayer && SoundPlayer.setCategory) {
    SoundPlayer.setCategory('Playback', true);
  }
} catch (e) {
  console.log('react-native-sound missing');
}

import { useTheme } from '../../../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STORAGE_KEY_READ_AUDIO = '@ecc_read_record_audio_path';
const STORAGE_KEY_TWISTER_AUDIO = '@ecc_twister_recordings_map';

// ─── LOCAL 3D ARTWORK ASSETS ───
const IMG_AI_SPEECH = require('../../../assets/ai_speach.png');
const IMG_1_1_TRAINER = require('../../../assets/1_1_trainer.png');
const IMG_READ_RECORD = require('../../../assets/read_and_record_card.png');
const IMG_TONGUE_TWISTER = require('../../../assets/tongue_twister_card.png');
const IMG_MINIMAL_PAIRS = require('../../../assets/minimal_pairs_card.png');

// ─── DEFAULT FALLBACKS ───
const DEFAULT_READ_RECORD = {
  title: 'The Rhythm of Natural Speech',
  difficulty: 'Intermediate',
  estMinutes: 3,
  passage: 'Fluency is built day by day with deliberate rhythm. When you speak, breathe deeply, articulate consonants clearly, and let your natural cadence lead every sentence with effortless confidence.'
};

const DEFAULT_TONGUE_TWISTERS = [
  { id: '1', title: 'Peter Piper', text: 'Peter Piper picked a peck of pickled peppers.', difficulty: 'Easy', color: '#10B981' },
  { id: '2', title: 'She Sells Seashells', text: 'She sells seashells by the seashore.', difficulty: 'Medium', color: '#F59E0B' },
  { id: '3', title: 'Betty Botter', text: 'Betty Botter bought some butter, but she said the butter’s bitter.', difficulty: 'Hard', color: '#EF4444' }
];

const DEFAULT_MINIMAL_PAIRS = [
  { id: '1', wordA: 'Ship', wordB: 'Sheep', ipaA: '/ʃɪp/', ipaB: '/ʃiːp/', soundRule: 'Short /ɪ/ vs Long /iː/', tip: 'Ship is brief and crisp; Sheep stretches the vocal chord.' },
  { id: '2', wordA: 'Bit', wordB: 'Beat', ipaA: '/bɪt/', ipaB: '/biːt/', soundRule: 'Short /ɪ/ vs Long /iː/', tip: 'Keep jaw relaxed for Bit; smile slightly for Beat.' },
  { id: '3', wordA: 'Cat', wordB: 'Cut', ipaA: '/kæt/', ipaB: '/kʌt/', soundRule: 'Open /æ/ vs Central /ʌ/', tip: 'Drop jaw wide for Cat; short chest push for Cut.' },
  { id: '4', wordA: 'Fan', wordB: 'Van', ipaA: '/fæn/', ipaB: '/væn/', soundRule: 'Voiceless /f/ vs Voiced /v/', tip: 'Fan uses silent breath; Van activates throat vibration.' }
];

export default function PracticeScreen({ navigation }: any) {
  const { theme, isDarkMode, t } = useTheme() as any;
  const colors = theme?.colors || {
    primary: '#6366F1',
    primaryGlow: 'rgba(99, 102, 241, 0.35)',
    bgLight: isDarkMode ? '#080C14' : '#F1F5F9',
    bgCard: isDarkMode ? 'rgba(17, 24, 39, 0.88)' : 'rgba(255, 255, 255, 0.94)',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    textPrimary: isDarkMode ? '#F9FAFB' : '#0F172A',
    textSecondary: isDarkMode ? '#9CA3AF' : '#64748B',
  };

  const primaryColor = colors.primary || '#6366F1';

  // State Management
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Firestore Content
  const [readRecordContent, setReadRecordContent] = useState<any>(DEFAULT_READ_RECORD);
  const [tongueTwisters, setTongueTwisters] = useState<any[]>(DEFAULT_TONGUE_TWISTERS);
  const [minimalPairs, setMinimalPairs] = useState<any[]>(DEFAULT_MINIMAL_PAIRS);

  // Modals
  const [activeModal, setActiveModal] = useState<'read_record' | 'tongue_twisters' | 'minimal_pairs' | 'coming_soon' | null>(null);
  const [comingSoonTitle, setComingSoonTitle] = useState('');

  // 🌟 Full Screen XP Reward Modal States
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [rewardDetails, setRewardDetails] = useState({
    title: 'Challenge Completed!',
    subtitle: "Great job! Today's practice is complete.",
    xpEarned: 20,
    streakCount: 1,
  });

  // Local Storage Recordings
  const [readRecordAudio, setReadRecordAudio] = useState<string | null>(null);
  const [twisterRecordingsMap, setTwisterRecordingsMap] = useState<{ [key: string]: string }>({});

  // Active Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Tongue Twister & Minimal Pairs State
  const [activeTwisterIdx, setActiveTwisterIdx] = useState(0);
  const [selectedPairWord, setSelectedPairWord] = useState<string | null>(null);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const soundRef = useRef<any>(null);
  const ttsSoundRef = useRef<any>(null);

  // Glow & Shimmer Animations
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const meshRotate1 = useRef(new Animated.Value(0)).current;
  const meshRotate2 = useRef(new Animated.Value(0)).current;

  // Load Saved Audio
  useEffect(() => {
    const loadSavedAudios = async () => {
      try {
        const savedRead = await AsyncStorage.getItem(STORAGE_KEY_READ_AUDIO);
        if (savedRead) setReadRecordAudio(savedRead);

        const savedTwisters = await AsyncStorage.getItem(STORAGE_KEY_TWISTER_AUDIO);
        if (savedTwisters) setTwisterRecordingsMap(JSON.parse(savedTwisters));
      } catch (err) {
        console.log('Error loading saved recordings:', err);
      }
    };
    loadSavedAudios();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseScale, {
            toValue: 1.025,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          })
        ]),
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          })
        ])
      ])
    ).start();

    Animated.loop(
      Animated.timing(meshRotate1, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(meshRotate2, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [glowAnim, pulseScale, shimmerAnim, meshRotate1, meshRotate2]);

  const spinInterpolate1 = meshRotate1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const spinInterpolate2 = meshRotate2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  useEffect(() => {
    const currentUser = auth().currentUser;

    let unsubUser = () => {};
    if (currentUser) {
      unsubUser = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .onSnapshot(
          (doc) => {
            if (doc && doc.exists()) {
              setUserData(doc.data());
            } else {
              setUserData({ minutesSpokenToday: 0, dailyGoalMinutes: 20 });
            }
            setLoading(false);
          },
          () => setLoading(false)
        );
    } else {
      setLoading(false);
    }

    const unsubContent = firestore()
      .collection('practice_content')
      .onSnapshot((snap) => {
        if (snap && !snap.empty) {
          snap.forEach((doc) => {
            const data = doc.data();
            if (doc.id === 'read_record' && data?.passage) {
              setReadRecordContent(data);
            } else if (doc.id === 'tongue_twisters' && Array.isArray(data?.items)) {
              setTongueTwisters(data.items);
            } else if (doc.id === 'minimal_pairs' && Array.isArray(data?.items)) {
              setMinimalPairs(data.items);
            }
          });
        }
      });

    return () => {
      unsubUser();
      unsubContent();
    };
  }, []);

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (hasPermission) return true;

        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'ECC App requires microphone access to record and practice pronunciation.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel'
          }
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const handleStartRecord = async () => {
    const hasPerm = await requestAudioPermission();
    if (!hasPerm) {
      Alert.alert('Permission Required', 'Please allow microphone permission to practice speaking.');
      return;
    }

    try {
      if (soundRef.current) {
        try { soundRef.current.stop(); soundRef.current.release(); } catch(e){}
        soundRef.current = null;
      }
      setIsPlayingAudio(false);

      const uniqueFileName = `practice_${Date.now()}.wav`;
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: uniqueFileName
      });

      setIsRecording(true);
      setRecordingTime(0);
      AudioRecord.start();

      let secs = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        secs += 1;
        setRecordingTime(secs);
      }, 1000);
    } catch (e: any) {
      setIsRecording(false);
      Alert.alert('Recording Error', e.message || 'Unable to start recording');
    }
  };

  const handleStopRecord = async (type: 'read_record' | 'tongue_twister') => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const audioPath = await AudioRecord.stop();
      setIsRecording(false);

      if (type === 'read_record') {
        setReadRecordAudio(audioPath);
        await AsyncStorage.setItem(STORAGE_KEY_READ_AUDIO, audioPath);
      } else {
        const currentTwisterId = tongueTwisters[activeTwisterIdx]?.id || `${activeTwisterIdx}`;
        const updated = {
          ...twisterRecordingsMap,
          [currentTwisterId]: audioPath
        };
        setTwisterRecordingsMap(updated);
        await AsyncStorage.setItem(STORAGE_KEY_TWISTER_AUDIO, JSON.stringify(updated));
      }
    } catch (e) {
      setIsRecording(false);
    }
  };

  const handleDeleteReadRecordAudio = async () => {
    if (soundRef.current) {
      try { soundRef.current.stop(); soundRef.current.release(); } catch(e){}
      soundRef.current = null;
    }
    setIsPlayingAudio(false);
    setReadRecordAudio(null);
    setRecordingTime(0);
    await AsyncStorage.removeItem(STORAGE_KEY_READ_AUDIO);
  };

  const handleDeleteTwisterAudio = async (twisterId: string) => {
    if (soundRef.current) {
      try { soundRef.current.stop(); soundRef.current.release(); } catch(e){}
      soundRef.current = null;
    }
    setIsPlayingAudio(false);
    const updated = { ...twisterRecordingsMap };
    delete updated[twisterId];
    setTwisterRecordingsMap(updated);
    setRecordingTime(0);
    await AsyncStorage.setItem(STORAGE_KEY_TWISTER_AUDIO, JSON.stringify(updated));
  };

  const handlePlayAudio = (filePath: string | null) => {
    if (!filePath || !SoundPlayer) return;

    if (isPlayingAudio && soundRef.current) {
      try { soundRef.current.stop(); } catch(e){}
      setIsPlayingAudio(false);
      return;
    }

    let targetPath = filePath;
    if (Platform.OS === 'android' && targetPath.startsWith('file://')) {
      targetPath = targetPath.replace('file://', '');
    }

    const sound = new SoundPlayer(targetPath, '', (error: any) => {
      if (error) {
        setIsPlayingAudio(false);
        return;
      }
      soundRef.current = sound;
      setIsPlayingAudio(true);
      sound.play(() => {
        setIsPlayingAudio(false);
        try { sound.release(); } catch(err){}
        soundRef.current = null;
      });
    });
  };

  // 🔊 DUAL ENGINE ACCENT CONTRAST (Female: UK, Male: US)
  const handleListenPronunciation = (word: string, gender: 'female' | 'male' = 'female') => {
    if (!SoundPlayer) return;
    
    if (ttsSoundRef.current) {
      try { ttsSoundRef.current.stop(); ttsSoundRef.current.release(); } catch(e){}
      ttsSoundRef.current = null;
    }

    setSpeakingWord(word);
    
    const voiceType = gender === 'female' ? '1' : '2';
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.trim())}&type=${voiceType}`;

    const sound = new SoundPlayer(audioUrl, '', (error: any) => {
      if (error) {
        setSpeakingWord(null);
        return;
      }
      ttsSoundRef.current = sound;
      sound.setVolume(1.0);
      sound.play(() => {
        setSpeakingWord(null);
        try { sound.release(); } catch(e){}
        ttsSoundRef.current = null;
      });
    });
  };

  // 🌟 WORKOUT SUBMISSION WITH VIDEO-LIKE CELEBRATION MODAL
  const handleCompletePracticeSession = async (
    type: 'read_record' | 'tongue_twisters' | 'minimal_pairs', 
    minutesToAdd: number, 
    xpToAdd: number
  ) => {
    const currentStreak = (userData?.streak || 1);

    // 1. Close active exercise modal cleanly
    closeModalOnly();

    // 2. Set reward details
    let sessionTitle = 'Challenge Completed!';
    if (type === 'read_record') sessionTitle = 'Reading Studio Complete!';
    if (type === 'tongue_twisters') sessionTitle = 'Tongue Twister Completed!';
    if (type === 'minimal_pairs') sessionTitle = 'Accent Lab Mastered!';

    setRewardDetails({
      title: sessionTitle,
      subtitle: `You earned +${xpToAdd} XP and added ${minutesToAdd}m to your goal!`,
      xpEarned: xpToAdd,
      streakCount: currentStreak,
    });

    // 3. Trigger video-matching Flying XP Modal
    setRewardModalVisible(true);

    // 4. Update Database in Background
    const currentUser = auth().currentUser;
    if (currentUser) {
      try {
        await firestore().collection('users').doc(currentUser.uid).set({
          minutesSpokenToday: firestore.FieldValue.increment(minutesToAdd),
          xp: firestore.FieldValue.increment(xpToAdd),
          lastPracticedAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {}
    }

    if (type === 'read_record') {
      setReadRecordAudio(null);
      await AsyncStorage.removeItem(STORAGE_KEY_READ_AUDIO);
    } else if (type === 'tongue_twisters') {
      setTwisterRecordingsMap({});
      await AsyncStorage.removeItem(STORAGE_KEY_TWISTER_AUDIO);
    }
  };

  const closeModalOnly = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isRecording) {
      try { AudioRecord.stop(); } catch(e){}
    }
    if (soundRef.current) {
      try { soundRef.current.stop(); soundRef.current.release(); } catch(e){}
      soundRef.current = null;
    }
    if (ttsSoundRef.current) {
      try { ttsSoundRef.current.stop(); ttsSoundRef.current.release(); } catch(e){}
      ttsSoundRef.current = null;
    }
    setIsRecording(false);
    setIsPlayingAudio(false);
    setActiveModal(null);
    setSelectedPairWord(null);
    setSpeakingWord(null);
  };

  if (loading) {
    return (
      <View style={[styles.mainContainer, { backgroundColor: colors.bgLight, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const spokenMinutes = userData?.minutesSpokenToday ?? 0;
  const targetGoalMinutes = userData?.dailyGoalMinutes ?? 20;
  const structuralPercentage = targetGoalMinutes > 0 
    ? Math.min(Math.round((spokenMinutes / targetGoalMinutes) * 100), 100) 
    : 0;

  const currentTwisterId = tongueTwisters[activeTwisterIdx]?.id || `${activeTwisterIdx}`;
  const currentTwisterAudio = twisterRecordingsMap[currentTwisterId] || null;

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={true} 
      />

      {/* 🌌 AMBIENT GLOWING ORBS */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        <Animated.View style={[
          styles.meshOrb1, 
          { 
            backgroundColor: isDarkMode ? '#4F46E5' : '#818CF8', 
            opacity: isDarkMode ? 0.22 : 0.45,
            transform: [{ rotate: spinInterpolate1 }]
          }
        ]} />
        <Animated.View style={[
          styles.meshOrb2, 
          { 
            backgroundColor: isDarkMode ? '#06B6D4' : '#38BDF8', 
            opacity: isDarkMode ? 0.18 : 0.4,
            transform: [{ rotate: spinInterpolate2 }]
          }
        ]} />
        <Animated.View style={[
          styles.meshOrb3, 
          { 
            backgroundColor: isDarkMode ? '#EC4899' : '#F472B6', 
            opacity: isDarkMode ? 0.15 : 0.35,
          }
        ]} />
      </View>
      
      {/* ─── FIXED TOP HEADER ─── */}
      <View style={[styles.fixedHeader, { backgroundColor: 'transparent' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t?.practice?.title || 'Practice'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t?.practice?.subtitle || 'Sharpen your speaking, your way'}
            </Text>
          </View>

          {/* Glowing Streak Badge */}
          <Animated.View style={[
            styles.streakBadge, 
            { 
              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.2)',
              borderColor: '#F59E0B',
              shadowColor: '#F59E0B',
              shadowOpacity: glowAnim,
              elevation: 4
            }
          ]}>
            <Flame size={16} color="#F59E0B" />
            <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 12.5, marginLeft: 4 }}>
              {userData?.streak || 1}d Streak
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Glowing Hero Button */}
        <Animated.View style={[
          styles.heroGlowWrapper,
          { 
            transform: [{ scale: pulseScale }],
            shadowColor: primaryColor,
            shadowOpacity: glowAnim,
          }
        ]}>
          <TouchableOpacity 
            style={[styles.heroButton, { backgroundColor: primaryColor }]} 
            activeOpacity={0.9}
            onPress={() => {
              setComingSoonTitle('AI Voice Coach');
              setActiveModal('coming_soon');
            }}
          >
            <View style={styles.heroSparkleWrap}>
              <Sparkles size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.heroButtonText}>
              {t?.practice?.yourCoach || 'YOUR AI COACH'}
            </Text>
            <Zap size={15} color="#FDE047" />
          </TouchableOpacity>
        </Animated.View>

        {/* 🌟 ULTRA-PREMIUM SHINING GLOWING WEEKLY GOAL CARD */}
        <Animated.View style={[
          styles.premiumGoalWrapper, 
          { 
            borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.25)',
            shadowColor: primaryColor,
            shadowOpacity: shimmerAnim,
          }
        ]}>
          <View style={[styles.premiumGoalCard, { backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.96)' }]}>
            
            <View style={styles.goalTopRow}>
              {/* Glowing Pulse Ring Icon */}
              <View style={styles.ringGlowContainer}>
                <Animated.View style={[
                  styles.outerPulseGlow,
                  {
                    borderColor: primaryColor,
                    opacity: glowAnim,
                    transform: [{ scale: pulseScale }]
                  }
                ]} />
                <View style={[styles.ringInnerSolid, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)' }]}>
                  <Target size={20} color={primaryColor} />
                </View>
              </View>

              <View style={styles.goalTextContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.goalHeaderTitle, { color: colors.textPrimary }]}>
                    {t?.practice?.weeklyGoal || 'Weekly goal'}
                  </Text>
                  <TrendingUp size={14} color="#10B981" />
                </View>
                <Text style={[styles.goalStatsSub, { color: colors.textSecondary }]}>
                  <Text style={[styles.boldStatHighlight, { color: colors.textPrimary }]}>
                    {spokenMinutes} / {targetGoalMinutes}
                  </Text> {t?.practice?.spokenToday || 'of 20 minutes spoken today'}
                </Text>
              </View>

              {/* Glowing Percentage Pill Badge */}
              <Animated.View style={[
                styles.neonBadgePill, 
                { 
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)',
                  borderColor: primaryColor,
                  shadowColor: primaryColor,
                  shadowOpacity: glowAnim,
                  elevation: 4
                }
              ]}>
                <Text style={[styles.neonBadgePillText, { color: primaryColor }]}>{structuralPercentage}%</Text>
              </Animated.View>
            </View>

            {/* Glowing Accent Horizontal Bar Track */}
            <View style={[styles.progressBarTrack, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.max(structuralPercentage, 6)}%`, 
                    backgroundColor: primaryColor,
                    shadowColor: primaryColor,
                    shadowOpacity: glowAnim
                  }
                ]} 
              />
            </View>
          </View>
        </Animated.View>

        {/* ─── 1 ROW, 2 EQUAL 3D GRAPHIC CARDS: AI COACH & 1:1 TRAINER ─── */}
        <View style={styles.gridContainerRow}>
          {/* AI Speaking Coach Graphic Card */}
          <TouchableOpacity 
            style={styles.topGraphicHalfCard} 
            activeOpacity={0.92}
            onPress={() => {
              setComingSoonTitle('AI Speaking Coach');
              setActiveModal('coming_soon');
            }}
          >
            <View style={styles.topImageInnerCropper}>
              <Image source={IMG_AI_SPEECH} style={styles.topImageFullBleed} resizeMode="cover" />
            </View>
            <View style={styles.gridMiniArrowBadge}>
              <ChevronRight color="#FFFFFF" size={13} />
            </View>
          </TouchableOpacity>

          {/* 1:1 Trainer Graphic Card */}
          <TouchableOpacity 
            style={styles.topGraphicHalfCard} 
            activeOpacity={0.92}
            onPress={() => {
              setComingSoonTitle('1:1 with a Trainer');
              setActiveModal('coming_soon');
            }}
          >
            <View style={styles.topImageInnerCropper}>
              <Image source={IMG_1_1_TRAINER} style={styles.topImageFullBleed} resizeMode="cover" />
            </View>
            <View style={styles.gridMiniArrowBadge}>
              <ChevronRight color="#FFFFFF" size={13} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── READ & RECORD 3D GRAPHIC BANNER ─── */}
        <TouchableOpacity 
          style={styles.bannerGraphicCard} 
          activeOpacity={0.92}
          onPress={() => setActiveModal('read_record')}
        >
          <Image source={IMG_READ_RECORD} style={styles.bannerImage} resizeMode="cover" />
          <View style={styles.bannerArrowBadge}>
            <ChevronRight color="#FFFFFF" size={16} />
          </View>
          {readRecordAudio && (
            <View style={styles.savedFloatingBadge}>
              <CheckCircle size={11} color="#10B981" />
              <Text style={styles.savedFloatingBadgeText}>Saved</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Section Heading */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 10 }}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {t?.practice?.quickDrills || 'Quick drills'}
          </Text>
          <Text style={{ fontSize: 11.5, color: primaryColor, fontWeight: '800' }}>Daily Refreshed</Text>
        </View>

        {/* ─── QUICK DRILLS: 1 ROW, 2 EQUAL 3D ARTWORK CARDS ─── */}
        <View style={styles.gridContainerRow}>
          {/* Tongue Twister Graphic Button */}
          <TouchableOpacity 
            style={styles.bottomGraphicHalfCard} 
            activeOpacity={0.92}
            onPress={() => {
              setActiveTwisterIdx(0);
              setActiveModal('tongue_twisters');
            }}
          >
            <Image source={IMG_TONGUE_TWISTER} style={styles.bottomImageCover} resizeMode="cover" />
            <View style={styles.gridMiniArrowBadge}>
              <ChevronRight color="#FFFFFF" size={13} />
            </View>
          </TouchableOpacity>

          {/* Minimal Pairs Graphic Button */}
          <TouchableOpacity 
            style={styles.bottomGraphicHalfCard} 
            activeOpacity={0.92}
            onPress={() => setActiveModal('minimal_pairs')}
          >
            <Image source={IMG_MINIMAL_PAIRS} style={styles.bottomImageCover} resizeMode="cover" />
            <View style={styles.gridMiniArrowBadge}>
              <ChevronRight color="#FFFFFF" size={13} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════
          MODAL 1: READ & RECORD
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'read_record'} animationType="slide" transparent={true} onRequestClose={closeModalOnly}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.teleprompterPill}>
                  <Radio size={12} color={primaryColor} />
                  <Text style={[styles.teleprompterPillText, { color: primaryColor }]}>READING STUDIO</Text>
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginTop: 4 }]}>
                  {readRecordContent.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    ⏱️ {readRecordContent.estMinutes || 3} min • {readRecordContent.difficulty || 'Intermediate'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeModalOnly} style={styles.modalCloseBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={[styles.teleprompterBox, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC', borderColor: colors.border }]} 
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.passageText, { color: colors.textPrimary }]}>
                {readRecordContent.passage}
              </Text>
            </ScrollView>

            {isRecording && (
              <View style={styles.waveStrip}>
                <View style={[styles.waveBar, { height: 18, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 32, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 24, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 40, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 20, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 36, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 26, backgroundColor: '#EF4444' }]} />
                <View style={[styles.waveBar, { height: 16, backgroundColor: '#EF4444' }]} />
              </View>
            )}

            <View style={styles.modalFooterActions}>
              {isRecording ? (
                <View style={styles.recordingActiveContainer}>
                  <View style={styles.redRecordingDot} />
                  <Text style={styles.recordingTimerText}>Listening & Recording... {recordingTime}s</Text>
                  <TouchableOpacity style={styles.stopRecordBtn} onPress={() => handleStopRecord('read_record')}>
                    <Text style={styles.stopRecordBtnText}>Finish</Text>
                  </TouchableOpacity>
                </View>
              ) : readRecordAudio ? (
                <View style={{ width: '100%', gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <TouchableOpacity 
                      style={[styles.audioPlaybackBtn, { borderColor: colors.border, backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]} 
                      onPress={() => handlePlayAudio(readRecordAudio)}
                    >
                      {isPlayingAudio ? <Pause size={17} color={primaryColor} /> : <Play size={17} color={primaryColor} />}
                      <Text style={[styles.audioPlaybackBtnText, { color: colors.textPrimary }]}>
                        {isPlayingAudio ? 'Pause Voice' : 'Listen Recording'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteReadRecordAudio()}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.border }]} onPress={handleStartRecord}>
                      <RotateCcw size={15} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Re-read</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={[styles.primaryActionBtn, { backgroundColor: primaryColor }]} 
                    onPress={() => handleCompletePracticeSession('read_record', readRecordContent.estMinutes || 3, 30)}
                  >
                    <CheckCircle size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Submit & Claim +30 XP</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.recordStartBtn, { backgroundColor: primaryColor }]} onPress={handleStartRecord}>
                  <Mic size={20} color="#FFFFFF" />
                  <Text style={styles.recordStartBtnText}>Hold Mic & Read Aloud</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL 2: TONGUE TWISTERS
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'tongue_twisters'} animationType="slide" transparent={true} onRequestClose={closeModalOnly}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.teleprompterPill}>
                  <Sliders size={12} color="#10B981" />
                  <Text style={[styles.teleprompterPillText, { color: '#10B981' }]}>SPEED & CLARITY DRILL</Text>
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginTop: 4 }]}>
                  {tongueTwisters[activeTwisterIdx]?.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Card {activeTwisterIdx + 1} of {tongueTwisters.length} • Level: {tongueTwisters[activeTwisterIdx]?.difficulty}
                </Text>
              </View>
              <TouchableOpacity onPress={closeModalOnly} style={styles.modalCloseBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.twisterCard, { backgroundColor: isDarkMode ? '#0B0F19' : '#EFF6FF', borderColor: colors.border }]}>
              <Text style={[styles.twisterMainText, { color: colors.textPrimary }]}>
                "{tongueTwisters[activeTwisterIdx]?.text}"
              </Text>
            </View>

            <View style={styles.modalFooterActions}>
              {isRecording ? (
                <View style={styles.recordingActiveContainer}>
                  <View style={styles.redRecordingDot} />
                  <Text style={styles.recordingTimerText}>Recording... {recordingTime}s</Text>
                  <TouchableOpacity style={styles.stopRecordBtn} onPress={() => handleStopRecord('tongue_twister')}>
                    <Text style={styles.stopRecordBtnText}>Finish</Text>
                  </TouchableOpacity>
                </View>
              ) : currentTwisterAudio ? (
                <View style={{ width: '100%', gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <TouchableOpacity 
                      style={[styles.audioPlaybackBtn, { borderColor: colors.border, backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]} 
                      onPress={() => handlePlayAudio(currentTwisterAudio)}
                    >
                      {isPlayingAudio ? <Pause size={17} color={primaryColor} /> : <Play size={17} color={primaryColor} />}
                      <Text style={[styles.audioPlaybackBtnText, { color: colors.textPrimary }]}>{isPlayingAudio ? 'Pause' : 'Listen'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTwisterAudio(currentTwisterId)}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.border }]} onPress={handleStartRecord}>
                      <RotateCcw size={15} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Retry</Text>
                    </TouchableOpacity>
                  </View>

                  {activeTwisterIdx + 1 < tongueTwisters.length ? (
                    <TouchableOpacity 
                      style={[styles.primaryActionBtn, { backgroundColor: primaryColor }]} 
                      onPress={() => {
                        setActiveTwisterIdx(i => i + 1);
                      }}
                    >
                      <Text style={styles.primaryActionBtnText}>Next Twister Card ›</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]} 
                      onPress={() => handleCompletePracticeSession('tongue_twisters', 3, 20)}
                    >
                      <CheckCircle size={18} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>Finish Workout (+20 XP)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity style={[styles.recordStartBtn, { backgroundColor: primaryColor }]} onPress={handleStartRecord}>
                  <Mic size={20} color="#FFFFFF" />
                  <Text style={styles.recordStartBtnText}>Tap & Speak as Fast as You Can</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL 3: MINIMAL PAIRS (DISTINCT FEMALE VS MALE VOICES)
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'minimal_pairs'} animationType="slide" transparent={true} onRequestClose={closeModalOnly}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.border, maxHeight: '88%' }]}>
            
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.teleprompterPill}>
                  <Headphones size={12} color="#0D9488" />
                  <Text style={[styles.teleprompterPillText, { color: '#0D9488' }]}>ACCENT & SOUND CONTRAST</Text>
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginTop: 4 }]}>
                  Minimal Pairs Lab
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Word A (Female Voice 👩) vs Word B (Male Voice 👨)
                </Text>
              </View>
              <TouchableOpacity onPress={closeModalOnly} style={styles.modalCloseBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
              {minimalPairs.map((pair, idx) => (
                <View key={pair.id || idx} style={[styles.pairRowCard, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.soundRuleTag}>{pair.soundRule}</Text>
                    {pair.tip && <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1, textAlign: 'right', marginLeft: 8 }}>💡 {pair.tip}</Text>}
                  </View>

                  <View style={styles.pairWordsContainer}>
                    {/* Word A (FEMALE ACCENT) */}
                    <View style={[
                      styles.wordButton, 
                      { backgroundColor: colors.bgCard, borderColor: selectedPairWord === `${idx}_A` ? primaryColor : colors.border },
                      speakingWord === pair.wordA && { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' }
                    ]}>
                      <TouchableOpacity onPress={() => setSelectedPairWord(`${idx}_A`)} style={{ alignItems: 'center', width: '100%' }}>
                        <Text style={[styles.wordMainText, { color: colors.textPrimary }]}>{pair.wordA}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, fontWeight: '600' }}>{pair.ipaA}</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.speakerPill, { backgroundColor: speakingWord === pair.wordA ? '#10B98120' : '#EC489918' }]}
                        onPress={() => handleListenPronunciation(pair.wordA, 'female')}
                        activeOpacity={0.7}
                      >
                        <Volume2 size={13} color={speakingWord === pair.wordA ? '#10B981' : '#EC4899'} />
                        <Text style={[styles.speakerPillText, { color: speakingWord === pair.wordA ? '#10B981' : '#EC4899' }]}>
                          {speakingWord === pair.wordA ? 'Speaking...' : 'Female 👩'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.vsBadgeContainer}>
                      <Text style={styles.vsBadgeText}>VS</Text>
                    </View>

                    {/* Word B (MALE ACCENT) */}
                    <View style={[
                      styles.wordButton, 
                      { backgroundColor: colors.bgCard, borderColor: selectedPairWord === `${idx}_B` ? primaryColor : colors.border },
                      speakingWord === pair.wordB && { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' }
                    ]}>
                      <TouchableOpacity onPress={() => setSelectedPairWord(`${idx}_B`)} style={{ alignItems: 'center', width: '100%' }}>
                        <Text style={[styles.wordMainText, { color: colors.textPrimary }]}>{pair.wordB}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, fontWeight: '600' }}>{pair.ipaB}</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.speakerPill, { backgroundColor: speakingWord === pair.wordB ? '#10B98120' : '#0284C718' }]}
                        onPress={() => handleListenPronunciation(pair.wordB, 'male')}
                        activeOpacity={0.7}
                      >
                        <Volume2 size={13} color={speakingWord === pair.wordB ? '#10B981' : '#0284C7'} />
                        <Text style={[styles.speakerPillText, { color: speakingWord === pair.wordB ? '#10B981' : '#0284C7' }]}>
                          {speakingWord === pair.wordB ? 'Speaking...' : 'Male 👨'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.primaryActionBtn, { backgroundColor: primaryColor, marginTop: 14 }]} 
              onPress={() => handleCompletePracticeSession('minimal_pairs', 3, 20)}
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Complete Contrast Lab (+20 XP)</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL 4: COMING SOON
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'coming_soon'} animationType="fade" transparent={true} onRequestClose={closeModalOnly}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.comingSoonCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.sparkleCircle, { backgroundColor: primaryColor + '18', borderColor: primaryColor + '30' }]}>
              <Sparkles size={30} color={primaryColor} />
            </View>
            <Text style={[styles.comingSoonHeading, { color: colors.textPrimary }]}>{comingSoonTitle}</Text>
            <Text style={[styles.comingSoonSub, { color: colors.textSecondary }]}>
              Our AI engine and mentor coordination system are being optimized for flawless real-time speech assessment.
            </Text>
            <TouchableOpacity style={[styles.gotItBtn, { backgroundColor: primaryColor }]} onPress={closeModalOnly}>
              <Text style={styles.gotItBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          🎉 FULL-SCREEN VIDEO-MATCHING XP REWARD ANIMATION MODAL
      ═══════════════════════════════════════════════════════ */}
      <XpRewardModal
        visible={rewardModalVisible}
        title={rewardDetails.title}
        subtitle={rewardDetails.subtitle}
        xpEarned={rewardDetails.xpEarned}
        streakCount={rewardDetails.streakCount}
        onComplete={() => setRewardModalVisible(false)}
      />

    </View>
  );
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },

  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  /* 🌌 FLOATING AMBIENT MESH ORBS */
  meshOrb1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 70,
  },
  meshOrb2: {
    position: 'absolute',
    top: 240,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 65,
  },
  meshOrb3: {
    position: 'absolute',
    bottom: 40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 60,
  },

  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: (STATUSBAR_HEIGHT || 0) + 14,
    paddingBottom: 8,
    zIndex: 10,
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 2, fontWeight: '500' },
  streakBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 14, 
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 100 },
  heroGlowWrapper: {
    marginBottom: 14,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  heroButton: {
    borderRadius: 22,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSparkleWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  heroButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13.5, letterSpacing: 0.8 },

  /* 🌟 PREMIUM GLOWING WEEKLY GOAL CARD STYLES */
  premiumGoalWrapper: {
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1.5,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    overflow: 'hidden',
  },
  premiumGoalCard: {
    borderRadius: 22,
    padding: 18,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ringGlowContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerPulseGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
  },
  ringInnerSolid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalTextContainer: { 
    flex: 1, 
    marginLeft: 14, 
    marginRight: 8 
  },
  goalHeaderTitle: { 
    fontSize: 16, 
    fontWeight: '900',
    letterSpacing: -0.2
  },
  goalStatsSub: { 
    fontSize: 12.5, 
    marginTop: 3,
    fontWeight: '500'
  },
  boldStatHighlight: { 
    fontWeight: '900' 
  },
  neonBadgePill: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 14, 
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  neonBadgePillText: { 
    fontWeight: '900', 
    fontSize: 13 
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },

  sectionHeading: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  
  /* ─── 2-CARDS ROW CONTAINER ─── */
  gridContainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },

  /* 🖼️ TOP 2 CARDS: AI COACH & 1:1 TRAINER */
  topGraphicHalfCard: {
    borderRadius: 22,
    width: '48%',
    aspectRatio: 1.38,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    backgroundColor: 'transparent',
  },
  topImageInnerCropper: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topImageFullBleed: {
    width: '116%',
    height: '116%',
    borderRadius: 22,
  },

  /* 🖼️ READ & RECORD BANNER */
  bannerGraphicCard: {
    width: '100%',
    aspectRatio: 2.6,
    borderRadius: 22,
    marginBottom: 4,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    backgroundColor: 'transparent',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  bannerArrowBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedFloatingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  savedFloatingBadgeText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '900'
  },

  /* 🖼️ BOTTOM 2 CARDS: QUICK DRILLS */
  bottomGraphicHalfCard: {
    borderRadius: 22,
    width: '48%',
    aspectRatio: 1.78,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    backgroundColor: 'transparent',
  },
  bottomImageCover: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  gridMiniArrowBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ─── MODAL STYLING ─── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18
  },
  modalBox: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 30,
    padding: 22,
    borderWidth: 1.5,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  teleprompterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2
  },
  teleprompterPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  teleprompterBox: {
    maxHeight: 190,
    borderRadius: 20,
    padding: 18,
    marginVertical: 10,
    borderWidth: 1.5
  },
  passageText: { fontSize: 15.5, lineHeight: 26, fontWeight: '600' },
  waveStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 48,
    marginVertical: 6
  },
  waveBar: {
    width: 4,
    borderRadius: 2
  },
  modalFooterActions: { marginTop: 14, alignItems: 'center' },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 8,
    width: '100%',
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  recordStartBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 },
  recordingActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.4)'
  },
  redRecordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 8 },
  recordingTimerText: { color: '#EF4444', fontWeight: '800', fontSize: 13, flex: 1 },
  stopRecordBtn: { backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  stopRecordBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  audioPlaybackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6
  },
  audioPlaybackBtnText: { fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    gap: 8,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  primaryActionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 },

  /* Tongue Twister Modal */
  twisterCard: {
    borderRadius: 24,
    padding: 24,
    marginVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5
  },
  twisterMainText: { fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 28 },

  /* Minimal Pairs Modal */
  pairRowCard: {
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5
  },
  soundRuleTag: { fontSize: 11, fontWeight: '800', color: '#0D9488', letterSpacing: 0.3 },
  pairWordsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 },
  wordButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5
  },
  wordMainText: { fontSize: 18, fontWeight: '900' },
  vsBadgeContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  vsBadgeText: { fontSize: 10.5, fontWeight: '900', color: '#64748B' },
  speakerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8
  },
  speakerPillText: { fontSize: 11, fontWeight: '800' },

  /* Coming Soon Modal */
  comingSoonCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 26,
    borderWidth: 1.5,
    alignItems: 'center'
  },
  sparkleCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  comingSoonHeading: { fontSize: 19, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  comingSoonSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  gotItBtn: { width: '100%', paddingVertical: 13, borderRadius: 18, alignItems: 'center', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  gotItBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }
});