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
import {
  checkIsHost,
  getMyUpcomingSessionsAsStudent,
  getMyUpcomingSessionsAsTeacher,
  getAllAvailableSlots,
  bookAndPaySession,
  joinVideoSession,
  getDemoConfig,
  checkIsAdmin,
  getMyTeacherProfile,
  getAudioSessionsForTeacher,
  getMyAudioBookingIds,
  type AudioSession,
  type OpenSlot,
  type DemoConfig,
} from '../../sessions/sessionService';
import { getSessionsToReview } from '../../sessions/reviewService';
import { useCallSession } from './CallSessionProvider';
import { launchAudioRoom } from '../../sessions/audioRoomLauncher';
import { getMySubscriptions } from '../../payments/paymentService';
import type { ProgramAccess } from '../../payments/paymentTypes';
import type { Booking } from '../../sessions/sessionTypes';
import { recordPracticeActivity, getEffectiveStreak } from '../../../services/streakService';
import XpRewardModal from './XpRewardModal';

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

// Used to keep a copy of a saved (cloud) recording on the phone, so it plays smoothly
let BlobUtil: any = null;
try {
  BlobUtil = require('react-native-blob-util').default;
} catch (e) {}

const hashText = (str: string): string => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(Math.abs(h));
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── ADMIN EMAILS ───
const KNOWN_ADMIN_EMAILS = [
  'jitendrakumar2k4@gmail.com',
  'codizumtech@gmail.com'
];

// ─── LOCAL ASSETS ───
const IMG_STREAK = require('../../../assets/streak.png');
const IMG_SMALL_TALK = require('../../../assets/small_talk.png');
const IMG_HERO_PUBLIC = require('../../../assets/publicroom.png');
const IMG_HERO_TRIAL = require('../../../assets/1-1session.png');
const IMG_HERO_PLANS = require('../../../assets/plancard.png');
const IMG_HERO_AUDIO = require('../../../assets/audiogroup.png');
const IMG_HERO_AI = require('../../../assets/ai.png');
const IMG_CHALLENGE_BANNER = require('../../../assets/challenge.png');
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

// Shared look of the Home "trial" and "plan" cards
// ── Animated press / "hover" feedback for the home cards ──
function useCardPress(toValue = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, friction: 5, tension: 160, useNativeDriver: true }).start();
  return { scale, pressIn: () => to(toValue), pressOut: () => to(1) };
}

// Card that fades/slides in, and springs smaller while pressed
function AnimatedCard({ children, onPress, style, delay = 0 }: {
  children: React.ReactNode; onPress?: () => void; style?: any; delay?: number;
}) {
  const { scale, pressIn, pressOut } = useCardPress(0.96);
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, delay]);
  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale }],
      }}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={style}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Wrapper that shrinks slightly while a finger is on it (for cards with inner buttons)
function HeroTouchScale({ children }: { children: React.ReactNode }) {
  const { scale, pressIn, pressOut } = useCardPress(0.98);
  return (
    <Animated.View
      style={{ transform: [{ scale }] }}
      onTouchStart={pressIn}
      onTouchEnd={pressOut}
      onTouchCancel={pressOut}
    >
      {children}
    </Animated.View>
  );
}

// Emoji that gently floats up and down
function FloatingEmoji({ emoji, size = 22, style }: { emoji: string; size?: number; style?: any }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -5, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.Text style={[{ fontSize: size, transform: [{ translateY: y }] }, style]}>{emoji}</Animated.Text>;
}

const HERO_W = SCREEN_WIDTH - 40;
// The banner images are 1100 x 554, so the card height follows the image (no cropping, no empty space)
const HERO_H = Math.round((HERO_W * 554) / 1100);
// Today's Challenge banner is 1200 x 429
const CHAL_W = SCREEN_WIDTH - 40;
const CHAL_H = Math.round((CHAL_W * 429) / 1200);

// A hero slide that is just the banner image (tap = open the screen)
function HeroImageSlide({ source, onPress, roundedClip = true }: { source: any; onPress: () => void; roundedClip?: boolean }) {
  const { scale, pressIn, pressOut } = useCardPress(0.97);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{ width: HERO_W, height: HERO_H, borderRadius: roundedClip ? 26 : 0, overflow: 'hidden' }}
      >
        <Image source={source} style={{ width: HERO_W, height: HERO_H }} resizeMode="cover" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// One promo slide of the home hero carousel (trial / plans)
function HeroPromoSlide({ bg, badge, title, desc, cta, emoji, onPress }: {
  bg: string; badge: string; title: string; desc: string; cta: string; emoji: string; onPress: () => void;
}) {
  const { scale, pressIn, pressOut } = useCardPress(0.97);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={[styles.bannerCardWrapper, { backgroundColor: bg, height: HERO_H }]}>
      <FloatingEmoji emoji={emoji} size={64} style={{ position: 'absolute', right: 14, top: 14, opacity: 0.9 }} />
      <View style={styles.liveHeroCardContent}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>{badge}</Text>
        </View>
        <Text style={[styles.heroCardTitle, { maxWidth: '75%' }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.heroCardDesc, { maxWidth: '78%' }]} numberOfLines={2}>{desc}</Text>
        <View style={[styles.heroFooterRow, { justifyContent: 'flex-end' }]}>
          <View style={styles.heroJoinButton}>
            <Text style={[styles.heroJoinBtnText, { color: bg }]}>{cta}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ───────────── Recent Activity: auto-sliding animated cards ─────────────
const ACT_W = SCREEN_WIDTH - 40;
const ACT_H = 108;
const activityLook = (id: string) => {
  if (id.startsWith('teacher_')) return { tag: 'NEW TEACHER', color: '#8B5CF6' };
  if (id.startsWith('audio_')) return { tag: 'AUDIO CLASS', color: '#0EA5E9' };
  if (id.startsWith('post_')) return { tag: 'COMMUNITY', color: '#10B981' };
  if (id.startsWith('room_')) return { tag: 'LIVE ROOM', color: '#F43F5E' };
  if (id.startsWith('booking_')) return { tag: 'BOOKING', color: '#F59E0B' };
  if (id.startsWith('sub_')) return { tag: 'PLAN', color: '#EAB308' };
  if (id.startsWith('rec_')) return { tag: 'CHALLENGE', color: '#6366F1' };
  return { tag: 'UPDATE', color: '#6366F1' };
};

function ActivitySlide({ item, index, scrollX, cardBg, textColor, subColor, onPress }: any) {
  const { tag, color } = activityLook(item.id);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const inputRange = [(index - 1) * ACT_W, index * ACT_W, (index + 1) * ACT_W];
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress && onPress(item)} style={{ width: ACT_W }}>
      <Animated.View
        style={{
          height: ACT_H,
          borderRadius: 24,
          backgroundColor: cardBg,
          borderWidth: 1.5,
          borderColor: color + '55',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          opacity,
          transform: [{ scale }],
        }}
      >
        <View style={{ position: 'absolute', right: -34, top: -34, width: 120, height: 120, borderRadius: 60, backgroundColor: color + '1A' }} />
        <View style={{ position: 'absolute', right: 30, bottom: -40, width: 80, height: 80, borderRadius: 40, backgroundColor: color + '12' }} />

        <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Animated.View
            style={{
              position: 'absolute', width: 52, height: 52, borderRadius: 18, backgroundColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }}
          />
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
            <FloatingEmoji emoji={item.icon} size={26} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: color + '24', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 5 }}>
            <Text style={{ color, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 }}>{tag}</Text>
          </View>
          <Text style={{ color: textColor, fontSize: 14.5, fontWeight: '800', lineHeight: 19 }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ color: subColor, fontSize: 11.5, fontWeight: '600', marginTop: 3 }}>
            {formatTimeAgo({ toDate: () => new Date(item.ts) })}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ActivitySlider({ items, cardBg, textColor, subColor, activeColor, onItemPress }: any) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const idxRef = useRef(0);
  const pausedRef = useRef(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idxRef.current >= items.length) {
      idxRef.current = 0;
      setIdx(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const next = (idxRef.current + 1) % items.length;
      idxRef.current = next;
      setIdx(next);
      scrollRef.current?.scrollTo({ x: next * ACT_W, animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, [items.length]);

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ACT_W}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onScrollBeginDrag={() => { pausedRef.current = true; }}
        onMomentumScrollEnd={(e: any) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / ACT_W);
          idxRef.current = i;
          setIdx(i);
          pausedRef.current = false;
        }}
      >
        {items.map((item: any, i: number) => (
          <ActivitySlide key={item.id} item={item} index={i} scrollX={scrollX} cardBg={cardBg} textColor={textColor} subColor={subColor} onPress={onItemPress} />
        ))}
      </Animated.ScrollView>
      {items.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 }}>
          {items.map((_: any, i: number) => (
            <View
              key={i}
              style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === idx ? activeColor : activeColor + '40' }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const homeActionCard = {
  width: '100%' as const,
  marginRight: 0,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
};
const homeIconCircle = {
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const homePill = { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 };
const homePillText = { fontSize: 13, fontWeight: '800' as const };

// Monday of the current week (local time) as YYYY-MM-DD. The weekly Speaking gain is only shown
// for the week it was earned in, so it goes back to +0 every Monday.
const getWeekKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  // ─── UPCOMING SESSIONS (real data) ───
  const [upcomingSessions, setUpcomingSessions] = useState<Booking[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // 🆕 OPEN/AVAILABLE SLOTS — un-booked slots of all teachers, so any user
  // can tap-to-book straight from here (without choosing a teacher first).
  // Students only (teachers/admins create slots via "Manage Session Slots",
  // they do not book them).
  const [availableSlots, setAvailableSlots] = useState<OpenSlot[]>([]);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  // 🆕 Demo class card: shown only while demo classes are on and this student has not used theirs.
  const [demoCfg, setDemoCfg] = useState<DemoConfig | null>(null);
  // Role flags: Admin Panel is for admins; Teacher Dashboard is for approved teachers
  const [isPanelAdmin, setIsPanelAdmin] = useState(false);
  // Finished sessions this student has not rated yet (card shows only when > 0)
  const [reviewCount, setReviewCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const loadReviews = () => {
      getSessionsToReview()
        .then((list) => alive && setReviewCount(list.length))
        .catch(() => {});
    };
    loadReviews();
    const unsub = navigation.addListener('focus', loadReviews);
    return () => {
      alive = false;
      unsub();
    };
  }, [navigation]);
  // Live public Study Room for the hero card: the public room with the most people in it right now.
  // Shows real data only; when nobody is live the card invites the student to start a room.
  const [liveRoom, setLiveRoom] = useState<any | null>(null);
  useEffect(() => {
    const unsub = firestore()
      .collection('voice_rooms')
      .where('type', '==', 'public')
      .onSnapshot(
        (snap) => {
          const rooms = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((r) => (r.totalParticipants || 0) > 0)
            .sort((a, b) => (b.totalParticipants || 0) - (a.totalParticipants || 0));
          setLiveRoom(rooms[0] || null);
        },
        () => setLiveRoom(null)
      );
    return () => unsub();
  }, []);
  // The student's booked (confirmed) upcoming sessions: drives the "My sessions / Join" card.
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  useEffect(() => {
    let alive = true;
    const loadBookings = () => {
      getMyUpcomingSessionsAsStudent()
        .then((list) => {
          if (!alive) return;
          // Drop sessions that ended more than 30 minutes ago (today's earlier sessions)
          const now = Date.now();
          setMyBookings(
            list.filter((b) => new Date(`${b.date}T${b.endTime}:00+05:30`).getTime() + 30 * 60000 > now)
          );
        })
        .catch(() => {});
    };
    loadBookings();
    const unsub = navigation.addListener('focus', loadBookings);
    const timer = setInterval(loadBookings, 60000);
    return () => {
      alive = false;
      unsub();
      clearInterval(timer);
    };
  }, [navigation]);
  // Next group audio class this student has booked a seat in (drives the Join button on the Audio card)
  const { startCall } = useCallSession();
  const [nextAudio, setNextAudio] = useState<AudioSession | null>(null);
  const [audioJoining, setAudioJoining] = useState(false);
  const [audioTick, setAudioTick] = useState(0);
  const [audioSub, setAudioSub] = useState<ProgramAccess | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setAudioTick((x) => x + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    const teacherId = audioSub?.active ? audioSub.teacherId : null;
    if (!teacherId) {
      setNextAudio(null);
      return;
    }
    getAudioSessionsForTeacher(teacherId)
      .then(async (list) => {
        const booked = await getMyAudioBookingIds(list.map((x) => x.id));
        if (!alive) return;
        setNextAudio(list.find((x) => booked.has(x.id)) || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [audioSub, audioTick]);
  const joinNextAudio = async () => {
    if (!nextAudio || audioJoining) return;
    setAudioJoining(true);
    try {
      await launchAudioRoom(startCall, nextAudio);
    } catch (e: any) {
      Alert.alert('Group Class', e?.message || 'Could not join the class. Please try again.');
    } finally {
      setAudioJoining(false);
    }
  };
  const [myTeacher, setMyTeacher] = useState<any | null>(null);
  useEffect(() => {
    let alive = true;
    const loadRoles = () => {
      // Checked separately: before, if the teacher lookup failed, the admin result was thrown away too
      // and the Admin Panel card never appeared for that admin.
      checkIsAdmin()
        .then((a) => { if (alive) setIsPanelAdmin(a); })
        .catch((e) => console.log('Admin check failed:', e));
      getMyTeacherProfile()
        .then((t) => { if (alive) setMyTeacher(t); })
        .catch(() => {});
    };
    loadRoles();
    const unsub = navigation.addListener('focus', loadRoles);
    return () => {
      alive = false;
      unsub();
    };
  }, [navigation]);

  // Video plan status (drives the plan card: "Choose your plan" vs "Book a Session")
  const [videoSub, setVideoSub] = useState<ProgramAccess | null>(null);
  useEffect(() => {
    if (isTeacher) return;
    let alive = true;
    // Fast path: read the demo config and this student's demo bookings straight
    // from Firestore (a few hundred ms). The callable `getDemoConfig` can take
    // 15-20 s on a cold start, so it is only a fallback if the direct read is blocked.
    const loadDemoFast = async (): Promise<DemoConfig> => {
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('not-signed-in');
      const [cfgSnap, bookSnap] = await Promise.all([
        firestore().doc('appConfig/demoClass').get(),
        firestore().collection('bookings').where('studentId', '==', uid).where('kind', '==', 'demo').get(),
      ]);
      const exists = typeof (cfgSnap as any).exists === 'function' ? (cfgSnap as any).exists() : (cfgSnap as any).exists;
      const d: any = exists ? cfgSnap.data() : null;
      const isActive = !!d && d.isActive === true && Number.isInteger(d.price) && d.price >= 0;
      const alreadyUsed = bookSnap.docs.some((b: any) => ['confirmed', 'completed'].includes(b.data().status));
      return { isActive, price: isActive ? d.price : 0, alreadyUsed };
    };

    const loadDemo = () => {
      loadDemoFast()
        .then((cfg) => alive && setDemoCfg(cfg))
        .catch(() => {
          getDemoConfig()
            .then((cfg) => alive && setDemoCfg(cfg))
            .catch(() => {});
        });
      getMySubscriptions()
        .then((subs) => {
          if (!alive) return;
          setVideoSub(subs.video);
          setAudioSub(subs.audio);
        })
        .catch(() => {});
    };
    loadDemo();
    const unsub = navigation.addListener('focus', loadDemo);
    return () => {
      alive = false;
      unsub();
    };
  }, [isTeacher, navigation]);

  // ── Hero carousel: public room / trial / plans, auto-slides every 4s ──
  const heroScrollRef = useRef<ScrollView>(null);
  const heroIdxRef = useRef(0);
  const heroPausedRef = useRef(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const showDemoSlide = !isTeacher && !!demoCfg?.isActive && !demoCfg.alreadyUsed;
  const showAudioPlanSlide = !isTeacher && !audioSub?.active;
  const heroSlideCount = 1 + (showDemoSlide ? 1 : 0) + (!isTeacher ? 1 : 0) + (showAudioPlanSlide ? 1 : 0) + 1; // + AI slide
  useEffect(() => {
    if (heroIdxRef.current >= heroSlideCount) {
      heroIdxRef.current = 0;
      setHeroIndex(0);
      heroScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
    if (heroSlideCount <= 1) return;
    const timer = setInterval(() => {
      if (heroPausedRef.current) return;
      const next = (heroIdxRef.current + 1) % heroSlideCount;
      heroIdxRef.current = next;
      setHeroIndex(next);
      heroScrollRef.current?.scrollTo({ x: next * HERO_W, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [heroSlideCount]);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      try {
        const isHost = await checkIsHost();
        const sessions = isHost
          ? await getMyUpcomingSessionsAsTeacher()
          : await getMyUpcomingSessionsAsStudent();

        if (isMounted) {
          setIsTeacher(isHost);
          setUpcomingSessions(sessions);
        }

        if (!isHost) {
          const slots = await getAllAvailableSlots();
          if (isMounted) setAvailableSlots(slots);
        }
      } catch (err) {
        console.error('Failed to load upcoming sessions:', err);
      } finally {
        if (isMounted) setSessionsLoading(false);
      }
    };

    loadSessions();
    // 🔑 THE ACTUAL FIX: this effect used to run only once on mount. If a
    // student booked a session in OneToOneSessionsScreen and came back to
    // Home (navigation.goBack()), HomeScreen was already mounted, so
    // loadSessions() did not run again and the new booking did not show up
    // in "Upcoming Sessions" until a full app reload. We now also refetch on
    // the 'focus' event, so Home always shows the latest data on return.
    const unsubscribeFocus = navigation.addListener('focus', loadSessions);

    return () => {
      isMounted = false;
      unsubscribeFocus();
    };
  }, [navigation]);

  // "Join" is allowed from 10 minutes before the session start; before that,
  // tapping the card only shows the details (join button disabled).
  const isSessionJoinable = (session: Booking) => {
    const sessionDateTime = new Date(`${session.date}T${session.startTime}:00`);
    const now = new Date();
    const minutesUntilStart = (sessionDateTime.getTime() - now.getTime()) / 60000;
    return minutesUntilStart <= 10 && minutesUntilStart > -60; // from 10 min before start until 1 hour after
  };

  const handleJoinSession = async (session: Booking) => {
    if (joiningSessionId) return; // only one join process at a time

    if (!isSessionJoinable(session)) {
      Alert.alert(
        'Not yet',
        `This session starts on ${session.date} at ${session.startTime}. The Join button becomes active 10 minutes before the start time.`
      );
      return;
    }

    setJoiningSessionId(session.id);
    try {
      const { serverUrl, token, otherPersonName, bookingId } =
        await joinVideoSession(session);

      navigation.navigate('VideoSessionScreen', {
        serverUrl,
        token,
        otherPersonName,
        bookingId,
      });
    } catch (err: any) {
      console.error('Join session error:', err);
      Alert.alert('Error', 'Could not join the session. Please try again.');
    } finally {
      setJoiningSessionId(null);
    }
  };

  // 🆕 ONE-TAP BOOK + PAY — runs when an open slot is tapped on the Home
  // card or in "See all". We first show a small confirm alert (price and
  // time), then call `bookAndPaySession()` (reserve booking + Razorpay
  // checkout). On success we refresh both lists (available slots and "my
  // sessions"): the slot that was just booked disappears from the available
  // list and, for the booking user, appears in their upcoming/joinable list.
  const handleBookSlot = (slot: OpenSlot) => {
    if (bookingSlotId) return; // only one booking process at a time

    const dateLabel = slot.date === new Date().toISOString().split('T')[0] ? 'Today' : slot.date;

    Alert.alert(
      'Confirm Booking',
      `Book a session with ${slot.teacherName} on ${dateLabel}, ${slot.startTime} - ${slot.endTime}?\n\nPrice: ₹${slot.teacherPricePerSession}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book & Pay',
          onPress: async () => {
            setBookingSlotId(slot.id);
            try {
              const result = await bookAndPaySession({
                teacherId: slot.teacherId,
                slotId: slot.id,
              });
              if (result.success) {
                Alert.alert(
                  'Booking Confirmed 🎉',
                  'Your session is booked. You can join from here at the scheduled time.'
                );
                // Refresh both lists — the booked slot must no longer show in
                // the available list, and the new booking must appear in
                // "my sessions".
                const [sessions, slots] = await Promise.all([
                  getMyUpcomingSessionsAsStudent(),
                  getAllAvailableSlots(),
                ]);
                setUpcomingSessions(sessions);
                setAvailableSlots(slots);
              } else {
                Alert.alert(
                  'Payment Incomplete',
                  'The payment was not completed and the slot has been released. Please try again.'
                );
                getAllAvailableSlots().then(setAvailableSlots).catch(() => {});
              }
            } catch (err: any) {
              console.error('handleBookSlot error:', err);
              const message =
                err?.message?.includes('already-exists') || err?.code === 'already-exists'
                  ? 'This slot was just booked by someone else. Please try another slot.'
                  : err?.message || 'Could not complete the booking. Please try again.';
              Alert.alert('Error', message);
              getAllAvailableSlots().then(setAvailableSlots).catch(() => {});
            } finally {
              setBookingSlotId(null);
            }
          },
        },
      ]
    );
  };

  
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
  // Admin = the fixed email list OR any email listed in the Firestore `admins` / `sub_admins` collections
  // (so an admin added in the Firebase console gets the admin tools in the app too).
  const [listAdmin, setListAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    const rawEmail = (currentUser?.email || '').trim();
    if (!rawEmail) {
      setListAdmin(false);
      return;
    }
    const emails = Array.from(new Set([rawEmail.toLowerCase(), rawEmail]));
    const inList = (col: string) =>
      firestore()
        .collection(col)
        .where('email', 'in', emails)
        .limit(1)
        .get()
        .then((snap: any) => !snap.empty)
        .catch(() => false);
    Promise.all([inList('admins'), inList('sub_admins')]).then(([a, b]) => {
      if (alive) setListAdmin(a || b);
    });
    return () => { alive = false; };
  }, [currentUser?.email]);
  const isAdmin = KNOWN_ADMIN_EMAILS.includes(currentEmailClean) || listAdmin;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [greetingKey, setGreetingKey] = useState<'goodMorning' | 'goodAfternoon' | 'goodEvening'>('goodMorning');
  
  const [latestCommunityPost, setLatestCommunityPost] = useState<any>(null);

  // 🕒 Recent activity: the user's own actions + what was newly added in the app
  type ActivityItem = { id: string; icon: string; title: string; ts: number; tab?: string };
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // 🔔 Unread notifications: the red dot shows only while something is unread, and the bell rings
  // when a new notification arrives (and again every few seconds while some stay unread).
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef<number | null>(null);
  const bellRotate = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  const ringBell = React.useCallback(() => {
    bellRotate.setValue(0);
    Animated.sequence([
      Animated.timing(bellRotate, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(bellRotate, { toValue: -1, duration: 160, useNativeDriver: true }),
      Animated.timing(bellRotate, { toValue: 0.8, duration: 140, useNativeDriver: true }),
      Animated.timing(bellRotate, { toValue: -0.6, duration: 120, useNativeDriver: true }),
      Animated.timing(bellRotate, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(bellRotate, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [bellRotate]);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const unsub = firestore()
      .collection('users').doc(uid).collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snap) => {
          // Same rule as the Notifications screen: anything not marked isRead === true is unread
          const count = snap ? snap.docs.filter((d: any) => d.data()?.isRead !== true).length : 0;
          setUnreadCount(count);
        },
        () => {}
      );
    return () => unsub();
  }, [currentUser?.uid]);

  // Ring when the number of unread notifications goes up
  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) ringBell();
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, ringBell]);

  // While something is unread: soft pulsing dot + a small ring every 8 seconds
  useEffect(() => {
    if (unreadCount <= 0) return;
    const pulse = Animated.loop(
      Animated.timing(dotPulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    pulse.start();
    const timer = setInterval(ringBell, 8000);
    return () => { pulse.stop(); dotPulse.setValue(0); clearInterval(timer); };
  }, [unreadCount > 0, ringBell, dotPulse]);

  // Recent Activity card tap → open the matching screen
  const handleActivityPress = (item: ActivityItem) => {
    const id = item.id;
    if (id.startsWith('booking_')) navigation.navigate('UpcomingSessionsListScreen');
    else if (id.startsWith('sub_')) navigation.navigate('ProgramFlowScreen');
    else if (id.startsWith('rec_')) openChallengeModal();
    else if (id.startsWith('post_')) navigation.navigate('Community');
    else if (id.startsWith('room_')) navigation.navigate('VoiceRoomScreen', { tab: item.tab || 'public' });
    else if (id.startsWith('teacher_')) navigation.navigate('OneToOneSessionsScreen');
    else if (id.startsWith('audio_')) navigation.navigate('VoiceRoomScreen', { tab: 'official' });
  };
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    let alive = true;
    const toMs = (t: any): number =>
      t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : typeof t === 'number' ? t : 0;
    const safe = async (fn: () => Promise<ActivityItem[]>) => {
      try {
        return await fn();
      } catch (e) {
        console.log('recent activity source error:', e);
        return [] as ActivityItem[];
      }
    };
    const db = firestore();

    const load = async () => {
      const results = await Promise.all([
        // My bookings (demo and 1-on-1 sessions)
        safe(async () => {
          const snap = await db.collection('bookings').where('studentId', '==', uid).get();
          return snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((b: any) => ['confirmed', 'completed', 'cancelled'].includes(b.status))
            .map((b: any) => ({
              id: `booking_${b.id}`,
              icon: b.status === 'cancelled' ? '❌' : b.kind === 'demo' ? '🎁' : '📅',
              title:
                b.status === 'cancelled'
                  ? `Cancelled your session with ${b.teacherName || 'a teacher'}`
                  : b.kind === 'demo'
                  ? `Booked a demo class with ${b.teacherName || 'a teacher'}`
                  : `Booked a session with ${b.teacherName || 'a teacher'}`,
              ts: toMs(b.createdAt),
            }));
        }),
        // My plans
        safe(async () => {
          const snap = await db.collection('subscriptions').where('userId', '==', uid).get();
          return snap.docs.map((d: any) => {
            const x = d.data();
            return {
              id: `sub_${d.id}`,
              icon: '👑',
              title: `Subscribed to ${x.planName || (x.mode === 'audio' ? 'Audio plan' : 'Video plan')}`,
              ts: toMs(x.createdAt) || toMs(x.startAt),
            };
          });
        }),
        // My challenge responses
        safe(async () => {
          const snap = await db.collection('challenge_recordings').where('uid', '==', uid).get();
          return snap.docs.map((d: any) => {
            const x = d.data();
            return {
              id: `rec_${d.id}`,
              icon: '🏆',
              title: `Submitted a challenge response${x.challengeTitle ? `: ${x.challengeTitle}` : ''}`,
              ts: toMs(x.createdAt),
            };
          });
        }),
        // Community posts (mine and others')
        safe(async () => {
          const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(10).get();
          return snap.docs.map((d: any) => {
            const x = d.data();
            const mine = x.uid === uid;
            return {
              id: `post_${d.id}`,
              icon: '💬',
              title: mine ? 'You posted in Community' : `${x.userName || x.authorName || 'Someone'} posted in Community`,
              ts: toMs(x.createdAt),
            };
          });
        }),
        // Study / class rooms
        safe(async () => {
          const snap = await db.collection('voice_rooms').orderBy('createdAt', 'desc').limit(5).get();
          return snap.docs.map((d: any) => {
            const x = d.data();
            const mine = x.createdBy === uid;
            const kind = x.type === 'official' ? 'class room' : 'study room';
            return {
              id: `room_${d.id}`,
              icon: '🎙️',
              title: mine ? `You started a ${kind}: ${x.title || ''}` : `New ${kind}: ${x.title || ''}`,
              ts: toMs(x.createdAt),
              tab: x.type === 'official' ? 'official' : 'public',
            };
          });
        }),
        // New teachers
        safe(async () => {
          const snap = await db.collection('session_teachers').orderBy('createdAt', 'desc').limit(3).get();
          return snap.docs
            .filter((d: any) => d.data().isActive !== false)
            .map((d: any) => ({
              id: `teacher_${d.id}`,
              icon: '🧑‍🏫',
              title: `New teacher joined: ${d.data().name || 'Teacher'}`,
              ts: toMs(d.data().createdAt),
            }));
        }),
        // New audio group classes
        safe(async () => {
          const snap = await db.collection('audioSessions').orderBy('createdAt', 'desc').limit(3).get();
          return snap.docs
            .filter((d: any) => d.data().status !== 'cancelled')
            .map((d: any) => ({
              id: `audio_${d.id}`,
              icon: '🎧',
              title: `New audio class: ${d.data().title || 'Group class'}`,
              ts: toMs(d.data().createdAt),
            }));
        }),
      ]);
      if (!alive) return;
      const merged = results
        .reduce((all: ActivityItem[], r) => all.concat(r), [])
        .filter((i) => i.ts > 0)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 6);
      setRecentActivity(merged);
      setActivityLoading(false);
    };

    load();
    // Refresh whenever the user comes back to Home
    const unsubFocus = navigation.addListener('focus', load);
    return () => {
      alive = false;
      unsubFocus();
    };
  }, [currentUser?.uid, navigation]);
  
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
  // All of this student's recordings from the last 30 days (older ones are auto-deleted on the server)
  const [myRecordings, setMyRecordings] = useState<any[]>([]);
  const [allAdminRecordings, setAllAdminRecordings] = useState<any[]>([]);
  const [activePlayingUrl, setActivePlayingUrl] = useState<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<any>(null);
  const soundInstanceRef = useRef<any>(null);
  const startingRecordRef = useRef(false);
  const elapsedRef = useRef(0);
  const durationLimitRef = useRef(MAX_CHALLENGE_SECONDS);

  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const borderShineAnim = useRef(new Animated.Value(0)).current;

  // Admin Topic Edit State
  const [isAdminEditTopicModal, setIsAdminEditTopicModal] = useState(false);
  // XP reward popup with the animated coins (same as Read & Record)
  const [rewardVisible, setRewardVisible] = useState(false);
  const [rewardInfo, setRewardInfo] = useState({ title: '', subtitle: '', xpEarned: 0, streakCount: 0 });
  // Playback helpers (a token ignores late callbacks of an older sound, so two voices can never play together)
  const playTokenRef = useRef(0);
  const audioLoadingRef = useRef(false);
  const soundTargetRef = useRef<string | null>(null);
  const [loadingAudioUrl, setLoadingAudioUrl] = useState<string | null>(null);
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
            setMyRecordings(docs);
          } else {
            setSavedUserRecording(null);
            setMyRecordings([]);
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

  // One attempt per topic: the key changes when the admin saves a new topic (title or update time changes)
  const getTopicKey = () => {
    const u: any = dailyTopicData?.updatedAt;
    const ms = u && typeof u.toMillis === 'function' ? u.toMillis() : 0;
    return `${dailyTopicData?.title || ''}|${ms}`;
  };
  const topicDone = !isAdmin && userData?.practiceDone?.daily_topic === getTopicKey();

  // 🎙️ START RECORDING
  const handleStartRecording = async () => {
    if (topicDone) {
      Alert.alert('Already completed ✅', 'You already completed this challenge. A new topic opens when the admin changes it.');
      return;
    }
    if (startingRecordRef.current) return;
    startingRecordRef.current = true;
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

      // A new file for every recording (re-using one file name made the new audio mix with the old one = double voice)
      try {
        AudioRecord.stop();
      } catch (e) {}
      if (AudioRecord && AudioRecord.init) {
        AudioRecord.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6,
          wavFile: `speaking_challenge_${Date.now()}.wav`,
        });
      }
      if (AudioRecord && AudioRecord.start) {
        AudioRecord.start();
      }

      setIsRecordingAudio(true);
      setIsPausedAudio(false);
      startRecordingTimer();
    } catch (e: any) {
      Alert.alert('Recording Error', e.message || 'Unable to start audio recording.');
    } finally {
      startingRecordRef.current = false;
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
      // Short tick so the local audio file is fully written to disk
      await new Promise((resolve) => setTimeout(resolve, 80));

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

      await reference.putFile(uploadUri, { contentType: 'audio/wav' });
      const downloadUrl = await reference.getDownloadURL();

      // XP is added only ONCE per topic, inside a transaction (two quick taps or two phones cannot add it twice)
      const topicKey = getTopicKey();
      const xpToAdd = Number(dailyTopicData?.rewardXP) || 10;
      const userRef = firestore().collection('users').doc(currentUser.uid);
      let granted = false;
      if (isAdmin) {
        granted = true; // admins can test the challenge again and again
        await userRef.set({ xp: firestore.FieldValue.increment(xpToAdd) }, { merge: true });
      } else {
        granted = await firestore().runTransaction(async (tx: any) => {
          const snap = await tx.get(userRef);
          const done = (snap.exists ? (snap.data() as any)?.practiceDone : null) || {};
          if (done.daily_topic === topicKey) return false;
          tx.set(
            userRef,
            {
              practiceDone: { daily_topic: topicKey },
              xp: firestore.FieldValue.increment(xpToAdd),
            },
            { merge: true }
          );
          return true;
        });
      }

      if (!granted) {
        setIsSavingAudio(false);
        setLocalRecordedAudioUri(null);
        Alert.alert('Already completed ✅', 'You already completed this challenge. A new topic opens when the admin changes it.');
        return;
      }

      await firestore().collection('challenge_recordings').add({
        challengeTitle: dailyTopicData.title,
        uid: currentUser.uid,
        studentName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
        userPhoto: currentUser.photoURL || null,
        audioUrl: downloadUrl,
        storagePath,
        durationSeconds: elapsedSeconds || 1,
        createdAt: firestore.FieldValue.serverTimestamp(),
        // Recordings are kept for 30 days; a daily Cloud Function deletes older ones (file + record).
        expiresAt: firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      });

      // counts as today's challenge for the streak and the Weekly goal
      const streakRes = await recordPracticeActivity('daily_topic');

      setIsSavingAudio(false);
      setLocalRecordedAudioUri(null);

      // Close the challenge window and show the XP popup with the animated coins
      setIsChallengeModalVisible(false);
      setRewardInfo({
        title: 'Challenge Completed!',
        subtitle: `You earned +${xpToAdd} XP. Your response is saved for 30 days.`,
        xpEarned: xpToAdd,
        streakCount: streakRes?.streak || getEffectiveStreak(userData) || 1,
      });
      setRewardVisible(true);
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
  //  - tap on the playing audio  -> pause
  //  - tap on the paused audio   -> resume
  //  - tap on another audio      -> the old one is stopped completely, then the new one starts
  // Only one sound can exist at a time (before, quick taps started two sounds = double / unclear voice).
  const handleTogglePlayAudio = (audioTarget: string) => {
    if (!audioTarget) return;
    if (!SoundPlayer) {
      Alert.alert('Cannot play', 'The audio player is not available. Please rebuild the app.');
      return;
    }
    if (audioLoadingRef.current) return; // still loading: ignore extra taps

    // Same audio that is already loaded: pause / resume
    if (soundInstanceRef.current && soundTargetRef.current === audioTarget) {
      const snd = soundInstanceRef.current;
      const tk = playTokenRef.current;
      if (activePlayingUrl === audioTarget) {
        try { snd.pause(); } catch (e) {}
        setActivePlayingUrl(null);
      } else {
        setActivePlayingUrl(audioTarget);
        snd.play((ok: boolean) => {
          if (tk !== playTokenRef.current) return;
          setActivePlayingUrl(null);
          try { snd.release(); } catch (e) {}
          if (soundInstanceRef.current === snd) {
            soundInstanceRef.current = null;
            soundTargetRef.current = null;
          }
        });
      }
      return;
    }

    // A different audio: stop the old one completely first
    stopAudioPlayback();
    const token = ++playTokenRef.current;

    const isRemote = /^https?:\/\//i.test(audioTarget);
    const plain = audioTarget.replace(/^file:\/\//, '');
    const candidates: string[] = isRemote
      ? [audioTarget]
      : Platform.OS === 'android'
        ? [plain, `file://${plain}`]
        : [plain];

    audioLoadingRef.current = true;
    setLoadingAudioUrl(audioTarget);

    const tryLoad = (i: number) => {
      const sound = new SoundPlayer(candidates[i], '', (error: any) => {
        if (error) {
          try { sound.release(); } catch (e) {}
          if (i + 1 < candidates.length) {
            tryLoad(i + 1);
            return;
          }
          audioLoadingRef.current = false;
          setLoadingAudioUrl(null);
          Alert.alert(
            'Cannot play recording',
            isRemote ? 'Could not load this recording. Please check your internet and try again.' : 'This recording could not be opened. Please record it again.'
          );
          return;
        }
        audioLoadingRef.current = false;
        setLoadingAudioUrl(null);
        if (token !== playTokenRef.current) {
          try { sound.release(); } catch (e) {}
          return;
        }
        soundInstanceRef.current = sound;
        soundTargetRef.current = audioTarget;
        try { sound.setVolume(1.0); } catch (e) {}
        setActivePlayingUrl(audioTarget);
        sound.play(() => {
          if (token !== playTokenRef.current) return;
          setActivePlayingUrl(null);
          try { sound.release(); } catch (e) {}
          if (soundInstanceRef.current === sound) {
            soundInstanceRef.current = null;
            soundTargetRef.current = null;
          }
        });
      });
    };

    // A cloud recording is saved on the phone once and played from there (no stalls, no stream glitches)
    (async () => {
      if (isRemote && BlobUtil) {
        try {
          const f = `${BlobUtil.fs.dirs.CacheDir}/challenge_${hashText(audioTarget)}.wav`;
          if (!(await BlobUtil.fs.exists(f))) {
            await BlobUtil.config({ path: f }).fetch('GET', audioTarget);
          }
          candidates.length = 0;
          candidates.push(f);
          if (Platform.OS === 'android') candidates.push(`file://${f}`);
        } catch (e) {
          console.log('Recording cache failed, streaming instead:', e);
        }
      }
      tryLoad(0);
    })();
  };

  const stopAudioPlayback = () => {
    playTokenRef.current++;
    if (soundInstanceRef.current) {
      try {
        soundInstanceRef.current.stop();
        soundInstanceRef.current.release();
      } catch (e) {}
      soundInstanceRef.current = null;
    }
    soundTargetRef.current = null;
    audioLoadingRef.current = false;
    setLoadingAudioUrl(null);
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
  const profilePhotoUrl = typeof userData?.photoURL === 'string' ? userData.photoURL : currentUser?.photoURL;

  const greetingText = t?.home?.[greetingKey] || 
    (greetingKey === 'goodMorning' ? 'Good morning,' : greetingKey === 'goodAfternoon' ? 'Good afternoon,' : 'Good evening,');

  const userStreak = getEffectiveStreak(userData);
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
            <Animated.View
              style={{
                transform: [{ rotate: bellRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-24deg', '24deg'] }) }],
              }}
            >
              <Text style={styles.bellIcon}>🔔</Text>
            </Animated.View>
            {unreadCount > 0 && (
              <>
                <Animated.View
                  style={[
                    styles.redDotBadge,
                    {
                      backgroundColor: colors.alertRed,
                      opacity: dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                      transform: [{ scale: dotPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
                    },
                  ]}
                />
                <View style={[styles.redDotBadge, { backgroundColor: colors.alertRed }]} />
              </>
            )}
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
                  {`+${userData?.weeklyGainWeek === getWeekKey() ? (Number(userData?.weeklySpeakingGain) || 0) : 0} this week`}
                </Text>
              </View>
            </View>

            <View style={[styles.ringMiniCard, { backgroundColor: cardBg, borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
              <View style={[styles.scoreBadgeCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.scoreValueText, { color: '#10B981' }]}>
                  ✨
                </Text>
              </View>
              <View style={styles.ringInfoTextContainer}>
                <Text style={[styles.ringTitle, { color: colors.textPrimary }]}>
                  {t?.home?.fluency || 'Fluency'}
                </Text>
                <Text style={[styles.ringSubtitle, { color: colors.textSecondary }]}>
                  Coming Soon
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. HERO CAROUSEL: live room + trial + plans (auto slide) */}
        <View style={styles.heroCardContainer}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={HERO_W}
            onScrollBeginDrag={() => { heroPausedRef.current = true; }}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
              heroIdxRef.current = i;
              setHeroIndex(i);
              heroPausedRef.current = false;
            }}
          >
            <View style={{ width: HERO_W }}>
          {liveRoom ? (
          <>
          <HeroTouchScale>
          <View style={[styles.bannerCardWrapper, { height: HERO_H }]}>
            <Image 
              source={IMG_SMALL_TALK} 
              style={styles.absoluteBackgroundCrop}
              resizeMode="cover"
            />
            
            <View style={styles.liveHeroCardContent}>
              <View style={styles.liveBadge}>
                <View style={[styles.liveBadgeDot, !liveRoom && { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.liveBadgeText}>{liveRoom ? (t?.home?.liveNow || 'LIVE NOW') : 'NO LIVE ROOM'}</Text>
              </View>

              <Text style={styles.heroCardTitle} numberOfLines={1}>
                {liveRoom ? liveRoom.title : 'Start a public room'} 👋
              </Text>
              <Text style={styles.heroCardDesc} numberOfLines={2}>
                {liveRoom
                  ? `Hosted by ${liveRoom.hostName || 'a member'}`
                  : 'No room is live right now. Be the first to start one!'}
              </Text>

              <View style={styles.heroFooterRow}>
                <View style={styles.heroAvatarStack}>
                  {liveRoom && (
                    <>
                      <View style={[styles.stackAvatar, { backgroundColor: '#3B82F6', marginLeft: 0 }]}>
                        <Text style={styles.stackAvatarText}>
                          {String(liveRoom.hostName || 'H').trim().slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      {(liveRoom.totalParticipants || 0) > 1 && (
                        <View style={[styles.stackAvatarCount]}>
                          <Text style={styles.stackAvatarCountText}>+{(liveRoom.totalParticipants || 1) - 1}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.heroJoinButton} 
                  activeOpacity={0.88}
                  onPress={() =>
                    navigation.navigate('VoiceRoomScreen', liveRoom ? { tab: 'public', roomId: liveRoom.id } : { tab: 'public' })
                  }
                >
                  <Text style={[styles.heroJoinBtnText, { color: '#6366F1' }]}>
                    {liveRoom ? (t?.home?.joinRoom || 'Join room →') : 'Start room →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </HeroTouchScale>
          </>
          ) : (
            <HeroImageSlide
              source={IMG_HERO_PUBLIC}
              onPress={() => navigation.navigate('VoiceRoomScreen', { tab: 'public' })}
            />
          )}
            </View>

            {showDemoSlide && (
              <View style={{ width: HERO_W }}>
                <HeroImageSlide
                  source={IMG_HERO_TRIAL}
                  onPress={() => navigation.navigate('DemoClassScreen')}
                />
              </View>
            )}

            {!isTeacher && (() => {
              // Active Video plan with sessions left -> "Book a Session"; otherwise -> "Choose your plan"
              const hasSessions = !!videoSub?.active && (videoSub.remainingSessions ?? 0) > 0;
              const usedUp = videoSub?.reason === 'no_sessions_left';
              return (
                <View style={{ width: HERO_W }}>
                  {!hasSessions && !usedUp ? (
                    <HeroImageSlide
                      source={IMG_HERO_PLANS}
                      onPress={() => navigation.navigate('ProgramFlowScreen')}
                    />
                  ) : (
                  <HeroPromoSlide
                    bg="#7C3AED"
                    badge={hasSessions ? 'VIDEO PLAN' : 'VIDEO CLASSES'}
                    emoji={hasSessions ? '📅' : '👑'}
                    title={hasSessions ? 'Book a Session' : usedUp ? 'All sessions used' : 'Choose your plan'}
                    desc={
                      hasSessions
                        ? `${videoSub!.remainingSessions} of ${videoSub!.totalSessions} sessions left with ${videoSub!.teacherName}`
                        : usedUp
                        ? 'You can buy a new plan after your current plan expires'
                        : 'Practice with experts in 1-on-1 video classes'
                    }
                    cta={hasSessions ? 'Book Now' : usedUp ? 'My plan' : 'Subscribe'}
                    onPress={() =>
                      hasSessions
                        ? navigation.navigate('BookSessionScreen')
                        : navigation.navigate('ProgramFlowScreen', usedUp ? { mode: 'video' } : undefined)
                    }
                  />
                  )}
                </View>
              );
            })()}

            {showAudioPlanSlide && (
              <View style={{ width: HERO_W }}>
                <HeroImageSlide
                  source={IMG_HERO_AUDIO}
                  roundedClip={false}
                  onPress={() => navigation.navigate('ProgramFlowScreen', { mode: 'audio' })}
                />
              </View>
            )}

            {/* AI conversation: coming soon */}
            <View style={{ width: HERO_W }}>
              <HeroImageSlide
                source={IMG_HERO_AI}
                roundedClip={false}
                onPress={() => Alert.alert('Coming Soon', 'AI conversation practice is coming soon. Stay tuned!')}
              />
            </View>
          </ScrollView>

          {heroSlideCount > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 6 }}>
              {Array.from({ length: heroSlideCount }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === heroIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === heroIndex ? colors.primary : colors.primary + '40',
                  }}
                />
              ))}
            </View>
          )}
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

          <View style={[styles.challengeBannerWrapper, { minHeight: 0, height: CHAL_H }]}>
            <Image
              source={IMG_CHALLENGE_BANNER}
              style={{ width: CHAL_W, height: CHAL_H }}
              resizeMode="cover"
            />

            {((savedUserRecording && !isAdmin) || (isAdmin && allAdminRecordings.length > 0)) && (
              <View style={{ position: 'absolute', left: 14, bottom: 10, flexDirection: 'row', gap: 8 }}>
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
            )}
          </View>
        </TouchableOpacity>

        {/* 🆕 TRIAL + PLAN CARDS (students only): the demo class and the subscription are separate cards.
            The demo card shows only while demo classes are on and this student has not used theirs. */}
        {!isTeacher && (
          <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 12 }}>
            {demoCfg?.isActive && !demoCfg.alreadyUsed && (
              <AnimatedCard
                style={[styles.upcomingSessionCard, homeActionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}
                onPress={() => navigation.navigate('DemoClassScreen')}
                delay={0}
              >
                <View style={[homeIconCircle, { backgroundColor: colors.primary + '1A' }]}>
                  <FloatingEmoji emoji="🎥" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Book 1-on-1 Trial</Text>
                  <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
                    Try a 30-minute class with a tutor
                  </Text>
                </View>
                <View style={[homePill, { backgroundColor: colors.primary }]}>
                  <Text style={[homePillText, { color: '#FFFFFF' }]}>
                    {demoCfg.price === 0 ? 'Book Now · Free' : `Book Now @${demoCfg.price}`}
                  </Text>
                </View>
              </AnimatedCard>
            )}

            {(() => {
              // Active Video plan with sessions left -> "Book a Session"; otherwise -> "Choose your plan"
              const hasSessions = !!videoSub?.active && (videoSub.remainingSessions ?? 0) > 0;
              const usedUp = videoSub?.reason === 'no_sessions_left';
              const title = hasSessions ? 'Book a Session' : usedUp ? 'All sessions used' : 'Choose your plan';
              const subtitle = hasSessions
                ? `${videoSub!.remainingSessions} of ${videoSub!.totalSessions} sessions left with ${videoSub!.teacherName}`
                : usedUp
                ? 'You can buy a new plan after your current plan expires'
                : 'Practice with experts';
              const cta = hasSessions ? 'Book Now' : usedUp ? 'My plan' : 'Subscribe';
              return (
                <AnimatedCard
                  style={[styles.upcomingSessionCard, homeActionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}
                  onPress={() =>
                    hasSessions
                      ? navigation.navigate('BookSessionScreen')
                      : navigation.navigate('ProgramFlowScreen', usedUp ? { mode: 'video' } : undefined)
                  }
                  delay={120}
                >
                  <View style={[homeIconCircle, { backgroundColor: '#F59E0B22' }]}>
                    <FloatingEmoji emoji={hasSessions ? '📅' : '👑'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>{subtitle}</Text>
                  </View>
                  <View style={[homePill, { backgroundColor: hasSessions ? colors.primary : colors.primary + '1A' }]}>
                    <Text style={[homePillText, { color: hasSessions ? '#FFFFFF' : colors.primary }]}>{cta}</Text>
                  </View>
                </AnimatedCard>
              );
            })()}

            {!!audioSub?.active && (() => {
              const startMs = nextAudio ? new Date(`${nextAudio.date}T${nextAudio.startTime}:00`).getTime() : 0;
              const endMs = nextAudio ? new Date(`${nextAudio.date}T${nextAudio.endTime}:00`).getTime() : 0;
              const canJoin = !!nextAudio && Date.now() >= startMs - 10 * 60000 && Date.now() <= endMs;
              return (
                <AnimatedCard
                  style={[styles.upcomingSessionCard, homeActionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}
                  onPress={() => navigation.navigate('VoiceRoomScreen', { tab: 'official' })}
                  delay={240}
                >
                  <View style={[homeIconCircle, { backgroundColor: colors.primary + '1A' }]}>
                    <FloatingEmoji emoji="🎙️" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Audio Classes</Text>
                    <Text style={[styles.sessionDescText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {nextAudio
                        ? `${nextAudio.title} · ${nextAudio.date} · ${nextAudio.startTime}`
                        : `Live group classes with ${audioSub.teacherName}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={audioJoining}
                    onPress={canJoin ? joinNextAudio : () => navigation.navigate('VoiceRoomScreen', { tab: 'official' })}
                    style={[homePill, { backgroundColor: canJoin ? '#10B981' : colors.primary }]}
                  >
                    {audioJoining ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[homePillText, { color: '#FFFFFF' }]}>{canJoin ? 'Join' : 'View'}</Text>
                    )}
                  </TouchableOpacity>
                </AnimatedCard>
              );
            })()}
          </View>
        )}


        {/* My booked sessions + Join: students see their next 1-1 session here */}
        {!isTeacher && myBookings.length > 0 && (() => {
          const next = myBookings[0];
          const startMs = new Date(`${next.date}T${next.startTime}:00+05:30`).getTime();
          const live = startMs - Date.now() <= 10 * 60000;
          return (
            <TouchableOpacity
              style={[
                styles.upcomingSessionCard,
                homeActionCard,
                { backgroundColor: cardBg, borderColor: activeGlowBorder, marginLeft: 20, width: SCREEN_WIDTH - 40, marginTop: 12 },
              ]}
              onPress={() => navigation.navigate('UpcomingSessionsListScreen')}
              activeOpacity={0.85}
            >
              <View style={[homeIconCircle, { backgroundColor: '#10B98122' }]}>
                <Text style={{ fontSize: 22 }}>🎥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>
                  {myBookings.length > 1 ? `My sessions (${myBookings.length})` : 'My session'}
                </Text>
                <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
                  {next.teacherName} · {next.date} · {next.startTime} - {next.endTime}
                </Text>
              </View>
              <View style={[homePill, { backgroundColor: live ? '#10B981' : colors.primary }]}>
                <Text style={[homePillText, { color: '#FFFFFF' }]}>{live ? 'Join' : 'View'}</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Rate your sessions: only while the student has finished sessions without a review */}
        {reviewCount > 0 && (
          <TouchableOpacity
            style={[
              styles.upcomingSessionCard,
              homeActionCard,
              { backgroundColor: cardBg, borderColor: activeGlowBorder, marginLeft: 20, width: SCREEN_WIDTH - 40, marginTop: 12 },
            ]}
            onPress={() => navigation.navigate('RateSessionsScreen')}
            activeOpacity={0.85}
          >
            <View style={[homeIconCircle, { backgroundColor: '#F59E0B22' }]}>
              <Text style={{ fontSize: 22 }}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Rate your sessions</Text>
              <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
                {reviewCount === 1 ? '1 session is waiting for your review' : `${reviewCount} sessions are waiting for your review`}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Teacher Dashboard: only approved teachers (an admin adds their email in the Admin Panel) */}
        {!!myTeacher && (
          <TouchableOpacity
            style={[
              styles.upcomingSessionCard,
              homeActionCard,
              { backgroundColor: cardBg, borderColor: activeGlowBorder, marginLeft: 20, width: SCREEN_WIDTH - 40, marginTop: 12 },
            ]}
            onPress={() => navigation.navigate('TeacherDashboardScreen')}
            activeOpacity={0.85}
          >
            <View style={[homeIconCircle, { backgroundColor: colors.primary + '1A' }]}>
              <Text style={{ fontSize: 22 }}>🧑‍🏫</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Teacher Dashboard</Text>
              <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
                Your slots, sessions and profile
              </Text>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Admin Panel: teacher access, plan prices, demo class price (admins only) */}
        {/* Shown for anyone on the admin lists. The panel and the server still re-check every action. */}
        {(isPanelAdmin || isAdmin) && (
          <TouchableOpacity
            style={[
              styles.upcomingSessionCard,
              homeActionCard,
              { backgroundColor: cardBg, borderColor: activeGlowBorder, marginLeft: 20, width: SCREEN_WIDTH - 40, marginTop: 12 },
            ]}
            onPress={() => navigation.navigate('AdminPanelScreen')}
            activeOpacity={0.85}
          >
            <View style={[homeIconCircle, { backgroundColor: '#F59E0B22' }]}>
              <Text style={{ fontSize: 22 }}>🛠️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Admin Panel</Text>
              <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>
                Teacher access, plan prices and demo class price
              </Text>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        )}

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
          {activityLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
          ) : recentActivity.length === 0 ? (
            <View style={[styles.activityItemRow, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
              <View style={[styles.activityIconWrapper, { backgroundColor: colors.primary + '1F' }]}>
                <Text style={styles.actIcon}>✨</Text>
              </View>
              <View style={styles.activityMainDetails}>
                <Text style={[styles.activityTitleText, { color: colors.textPrimary }]}>No recent activity yet</Text>
                <Text style={[styles.activityTimeTextOffset, { color: colors.textSecondary }]}>
                  Book a class or join a room to get started
                </Text>
              </View>
            </View>
          ) : (
            <ActivitySlider
              items={recentActivity}
              cardBg={cardBg}
              textColor={colors.textPrimary}
              subColor={colors.textSecondary}
              activeColor={colors.primary}
              onItemPress={handleActivityPress}
            />
          )}
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

              {/* 🎧 SECTION 2: MY SAVED RECORDINGS (PRIVATE TO THIS STUDENT, KEPT FOR 30 DAYS) */}
              {!isAdmin && myRecordings.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.adminSubmissionsHeading, { color: colors.textPrimary }]}>
                    Your Recordings ({myRecordings.length})
                  </Text>
                  <Text style={[styles.audioEmptyHint, { color: colors.textSecondary, marginBottom: 8, marginTop: 2 }]}>
                    Saved for 30 days, then deleted automatically.
                  </Text>
                  {myRecordings.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.adminAudioItemCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        style={[styles.playPreviewMiniBtn, { backgroundColor: activePlayingUrl === item.audioUrl ? '#EF4444' : colors.primary }]}
                        onPress={() => handleTogglePlayAudio(item.audioUrl)}
                      >
                        {activePlayingUrl === item.audioUrl ? <Pause size={14} color="#FFFFFF" /> : <Play size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.adminAudioStudentName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.challengeTitle || 'Speaking challenge'}
                        </Text>
                        <Text style={[styles.adminAudioStudentSub, { color: colors.textSecondary }]}>
                          {item.durationSeconds}s • {formatTimeAgo(item.createdAt)}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteAudioBtn} onPress={() => handleDeleteFirestoreRecording(item.id, item.audioUrl)}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
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

              {/* ✅ Already done: one attempt per topic */}
              {topicDone && !localRecordedAudioUri && (
                <View style={[styles.audioStatusCard, { backgroundColor: isDarkMode ? '#0F172A' : '#ECFDF5', borderColor: '#10B981', marginTop: 10 }]}>
                  <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 14, textAlign: 'center' }}>
                    ✅ Challenge completed
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
                    You can attempt this topic only once. A new challenge opens when the admin changes the topic.
                  </Text>
                </View>
              )}

              {/* 🎙️ RECORDING CONTROL ACTIONS */}
              <View style={styles.micActionContainer}>
                {!localRecordedAudioUri && !topicDone && (
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

                {!topicDone && (
                <Text style={[styles.micStatusLabel, { color: colors.textSecondary }]}>
                  {isRecordingAudio
                    ? `Speaking (${elapsedSeconds}s / ${dailyTopicData?.durationSec || 60}s) • Tap Complete when done`
                    : localRecordedAudioUri
                      ? `Audio draft ready (${elapsedSeconds}s) • Tap Send Response to save`
                      : `Max duration: ${dailyTopicData?.durationSec || 60}s (Speak any length)`}
                </Text>
                )}
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

      {/* ─── 🪙 XP REWARD POPUP (animated coins) ─── */}
      <XpRewardModal
        visible={rewardVisible}
        title={rewardInfo.title}
        subtitle={rewardInfo.subtitle}
        xpEarned={rewardInfo.xpEarned}
        streakCount={rewardInfo.streakCount}
        onComplete={() => setRewardVisible(false)}
      />

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
  horizontalScrollWrapper: { paddingLeft: 20, paddingRight: 4, marginTop: 12 },
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