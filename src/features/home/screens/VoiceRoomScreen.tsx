import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { useFocusEffect } from '@react-navigation/native';
import { useCallSession } from './CallSessionProvider';
import {
  getAudioSessionsForTeacher,
  getMyAudioBookingIds,
  bookAudioSession,
  getMyTeacherProfile,
  createAudioSession,
  type AudioSession,
} from '../../sessions/sessionService';
import { launchAudioRoom } from '../../sessions/audioRoomLauncher';
import { getMySubscriptions } from '../../payments/paymentService';

import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  Users,
  Share2,
  Sparkles,
  X,
  UserCheck,
  Plus,
  Radio,
  GraduationCap,
} from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 0);
const LIVEKIT_FALLBACK_URL = 'wss://eccapp-4hmra95b.livekit.cloud';

export const ILLUSTRATED_AVATARS = [
  { id: 'm1', gender: 'Male', label: 'Boy 1', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundColor=ffd5dc' },
  { id: 'f1', gender: 'Female', label: 'Girl 1', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Zoe&backgroundColor=ffdfbf' },
  { id: 'm2', gender: 'Male', label: 'Boy 2', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Felix&backgroundColor=c0aede' },
  { id: 'f2', gender: 'Female', label: 'Girl 2', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Lily&backgroundColor=d1d4f9' },
  { id: 'm3', gender: 'Male', label: 'Boy 3', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Milo&backgroundColor=b6e3f4' },
  { id: 'f3', gender: 'Female', label: 'Girl 3', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Chloe&backgroundColor=ffd5dc' },
  { id: 'm4', gender: 'Male', label: 'Boy 4', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Jack&backgroundColor=ffdfbf' },
  { id: 'f4', gender: 'Female', label: 'Girl 4', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Sophie&backgroundColor=c0aede' },
  { id: 'm5', gender: 'Male', label: 'Boy 5', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Lucas&backgroundColor=d1d4f9' },
  { id: 'f5', gender: 'Female', label: 'Girl 5', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Emma&backgroundColor=b6e3f4' },
  { id: 'm6', gender: 'Male', label: 'Boy 6', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Alexander&backgroundColor=ffd5dc' },
  { id: 'f6', gender: 'Female', label: 'Girl 6', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Mia&backgroundColor=ffdfbf' },
  { id: 'm7', gender: 'Male', label: 'Classic Boy 1', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Sam&backgroundColor=b6e3f4' },
  { id: 'f7', gender: 'Female', label: 'Classic Girl 1', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Jessica&backgroundColor=ffd5dc' },
  { id: 'm8', gender: 'Male', label: 'Classic Boy 2', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Ethan&backgroundColor=d1d4f9' },
  { id: 'f8', gender: 'Female', label: 'Classic Girl 2', url: 'https://api.dicebear.com/7.x/avataaars/png?seed=Hannah&backgroundColor=ffdfbf' },
  { id: 'm9', gender: 'Male', label: 'Modern Boy', url: 'https://api.dicebear.com/7.x/micah/png?seed=Mason&backgroundColor=c0aede' },
  { id: 'f9', gender: 'Female', label: 'Modern Girl', url: 'https://api.dicebear.com/7.x/micah/png?seed=Harper&backgroundColor=b6e3f4' },
];

interface VoiceRoom {
  id: string;
  title: string;
  category?: string;
  hostName?: string;
  activeSpeakersCount?: number;
  totalParticipants?: number;
  livekitRoomId: string;
  createdBy: string;
  type?: 'public' | 'official';
  maxLimit?: number;
  createdAt?: any;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function VoiceRoomScreen({ navigation, route }: any) {
  const themeHook = useTheme() as any;
  const t = themeHook?.t;
  const currentLang = themeHook?.currentLang || 'en';

  // route.params.tab = 'official' opens the Class Rooms tab directly (Home "Join Group Class" card)
  const [activeTab, setActiveTab] = useState<'public' | 'official'>(
    route?.params?.tab === 'official' ? 'official' : 'public'
  );
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);

  const pagerRef = useRef<ScrollView>(null);

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);

  // Real number of people inside each room (from the presence heartbeat written by the room screen)
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const presenceDocsRef = useRef<Record<string, Record<string, number | null>>>({});
  const [presenceTick, setPresenceTick] = useState(0);

  // One shared blink value: drives the red LIVE dot and the card border pulse
  const blinkAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blinkAnim]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [isAdminOrSubAdmin, setIsAdminOrSubAdmin] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(true);

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [roomCategory, setRoomCategory] = useState<string>('General English');
  const [creating, setCreating] = useState<boolean>(false);

  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState<boolean>(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(''); // optional: nothing is pre-selected
  const [pendingJoinRoom, setPendingJoinRoom] = useState<VoiceRoom | null>(null);
  const [isJoiningPending, setIsJoiningPending] = useState<boolean>(false);

  // 🖤 WHITE-SCREEN / DEAD-TOUCH SAFETY NET: Agar kisi bhi wajah se
  // `isModalVisible` (Create Room form) ya `showAvatarPickerModal` (avatar
  // picker) stuck `true` reh jaaye — jaise create/join flow ke beech me
  // koi error/interruption aa jaaye jahan humara `closeModal()`/
  // `setShowAvatarPickerModal(false)` call hi na ho paaye — to wo poore-
  // screen-cover karne wala overlay HAMESHA ke liye khula reh jaata hai.
  // Chahe uska content kisi wajah se blank/white dikhe, ye overlay phir
  // bhi saare touches KHUD absorb karta rehta hai — isliye peeche ki
  // screen "bilkul dead" lagti hai (koi tap response nahi milta), jab tak
  // koi Class Room call join karke leave/minimize na kare aur wapas is
  // screen par focus na aaye.
  //
  // Fix: jab bhi ye screen FOCUS me aaye (jaise Class Room se leave karke
  // wapas aane par), dono modals ko FORCE-CLOSE kar dete hain. Isse chahe
  // asli root-cause kuch bhi ho, koi leftover modal kabhi is screen ko
  // permanently block nahi kar payega.
  useFocusEffect(
    React.useCallback(() => {
      setIsModalVisible(false);
      setShowAvatarPickerModal(false);
    }, [])
  );

  const currentUser = auth().currentUser;

  // 🖤 NATIVE-SURFACE RESIDUE WORKAROUND (see CallSessionProvider.tsx for
  // full explanation): LiveKit's React Native SDK doesn't yet support the
  // New Architecture, so a leftover camera/video native surface can
  // sometimes paint a white "ghost" overlay over this screen after a call
  // minimizes or ends — with no JS error, since it happens outside
  // Fabric's control. `remountSignal` increments every time the call
  // state changes; using it as this screen's root `key` forces a full
  // unmount+remount whenever that happens, which recreates the native
  // view tree from scratch and clears any such residue.
  const { remountSignal, startCall } = useCallSession();

  // ─── GROUP AUDIO CLASSES (shown at the top of the Class Rooms tab) ───
  // Student: classes of the teacher linked to their Audio plan. Teacher: their own classes.
  const [audioSessions, setAudioSessions] = useState<AudioSession[]>([]);
  const [audioBooked, setAudioBooked] = useState<Set<string>>(new Set());
  const [audioRole, setAudioRole] = useState<'student' | 'teacher' | 'none'>('none');
  const [audioPlanActive, setAudioPlanActive] = useState<boolean>(true);
  const [audioBusyId, setAudioBusyId] = useState<string | null>(null);

  // Teacher: create a group audio class from this screen
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classTitle, setClassTitle] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [classDayOffset, setClassDayOffset] = useState(0);
  const [classHour, setClassHour] = useState('18');
  const [classMin, setClassMin] = useState('00');
  const [classDuration, setClassDuration] = useState(60);
  const [classSeats, setClassSeats] = useState('10');
  const [classSaving, setClassSaving] = useState(false);

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const classDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const submitClass = async () => {
    if (classSaving) return;
    const h = parseInt(classHour, 10);
    const m = parseInt(classMin === '' ? '0' : classMin, 10);
    const seats = Number(classSeats);
    if (!classTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for the class.');
      return;
    }
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Invalid time', 'Enter hour 0-23 and minutes 0-59 (24-hour format).');
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 200) {
      Alert.alert('Invalid Seats', 'Maximum participants must be between 1 and 200.');
      return;
    }
    setClassSaving(true);
    try {
      await createAudioSession({
        title: classTitle.trim(),
        description: classDesc.trim(),
        date: dayKey(classDays[classDayOffset]),
        startTime: `${pad2(h)}:${pad2(m)}`,
        durationMins: classDuration,
        maxParticipants: seats,
      });
      setClassModalOpen(false);
      setClassTitle('');
      setClassDesc('');
      await loadAudioClasses();
      Alert.alert('Class Created', 'Students with your Audio plan can now book a seat.');
    } catch (e: any) {
      Alert.alert('Could Not Create', e?.message || 'Please try again.');
    } finally {
      setClassSaving(false);
    }
  };

  const loadAudioClasses = async () => {
    try {
      const teacher = await getMyTeacherProfile().catch(() => null);
      if (teacher) {
        setAudioRole('teacher');
        setAudioPlanActive(true);
        setAudioSessions(await getAudioSessionsForTeacher(teacher.id));
        return;
      }
      const subs = await getMySubscriptions();
      if (subs.audio?.active && subs.audio.teacherId) {
        setAudioRole('student');
        setAudioPlanActive(true);
        const list = await getAudioSessionsForTeacher(subs.audio.teacherId);
        setAudioSessions(list);
        setAudioBooked(await getMyAudioBookingIds(list.map((x) => x.id)));
      } else {
        setAudioRole('student');
        setAudioPlanActive(false);
        setAudioSessions([]);
      }
    } catch (e) {
      console.log('VoiceRoomScreen: audio classes load error', e);
    }
  };
  useFocusEffect(
    React.useCallback(() => {
      loadAudioClasses();
    }, [])
  );

  const handleAudioAction = async (session: AudioSession) => {
    if (audioBusyId) return;
    setAudioBusyId(session.id);
    try {
      if (audioRole === 'student' && !audioBooked.has(session.id)) {
        await bookAudioSession(session.id);
        await loadAudioClasses();
        Alert.alert('Seat booked', 'Your seat is booked. Come back here to join when the class starts.');
      } else {
        await launchAudioRoom(startCall, session);
      }
    } catch (e: any) {
      Alert.alert('Group Class', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setAudioBusyId(null);
    }
  };

  const renderAudioClasses = () => (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 6, marginBottom: 8 }}>
        Group Audio Classes
      </Text>
      {audioRole === 'student' && !audioPlanActive ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ProgramFlowScreen', { mode: 'audio' })}
          style={[styles.roomCardGlow, { backgroundColor: colors.bgCard, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.28)' : '#E2E8F0' }]}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 14 }}>Join group audio classes</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
            Get an Audio plan to book seats in live group classes. Tap to see plans.
          </Text>
        </TouchableOpacity>
      ) : audioSessions.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          No group audio class is scheduled right now.
        </Text>
      ) : (
        audioSessions.map((s) => {
          const isHost = audioRole === 'teacher';
          const booked = audioBooked.has(s.id);
          const full = !isHost && !booked && s.bookedCount >= s.maxParticipants;
          const label = isHost ? 'Join as host' : booked ? 'Join' : full ? 'Full' : 'Book seat';
          return (
            <View
              key={s.id}
              style={[styles.roomCardGlow, { backgroundColor: colors.bgCard, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.28)' : '#E2E8F0' }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{s.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                {s.teacherName} · {s.date} · {s.startTime} - {s.endTime}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {s.bookedCount}/{s.maxParticipants} seats booked
                </Text>
                <TouchableOpacity
                  disabled={full || audioBusyId === s.id}
                  onPress={() => handleAudioAction(s)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: full ? '#94A3B8' : '#0284C7', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  {audioBusyId === s.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>{label}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
      {roomDataListHasOfficial && (
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 14, marginBottom: 8 }}>
          Live Class Rooms
        </Text>
      )}
    </View>
  );
  const isDarkMode = themeHook?.isDarkMode || false;

  const colors = isDarkMode
    ? {
        bgLight: '#070D1B',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        primary: '#38BDF8',
        bgCard: 'rgba(15, 23, 42, 0.86)',
        border: 'rgba(56, 189, 248, 0.28)',
      }
    : {
        bgLight: '#F8FAFC',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        primary: '#0284C7',
        bgCard: 'rgba(255, 255, 255, 0.94)',
        border: '#E2E8F0',
      };

  const glowAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim]);

  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setIsAdminOrSubAdmin(false);
      setCheckingRole(false);
      return;
    }

    let isMounted = true;
    const checkAdminRights = async () => {
      const rawEmail = (currentUser.email || '').trim();
      const emails = Array.from(new Set([rawEmail.toLowerCase(), rawEmail])).filter(Boolean);

      // Each list is checked on its own: if one list cannot be read (for example a
      // Firestore rule is missing), the other one still decides. Before, a failure in
      // `sub_admins` also made real admins look like normal users, so "Create Room"
      // for Class Rooms did not appear.
      const isInList = async (collection: string) => {
        try {
          const snap = await firestore()
            .collection(collection)
            .where('email', 'in', emails)
            .limit(1)
            .get();
          return !snap.empty;
        } catch (error) {
          console.error(`Error checking ${collection}:`, error);
          return false;
        }
      };

      try {
        const [isAdminUser, isSubAdminUser] = await Promise.all([
          isInList('admins'),
          isInList('sub_admins'),
        ]);
        if (isMounted) setIsAdminOrSubAdmin(isAdminUser || isSubAdminUser);
      } finally {
        if (isMounted) setCheckingRole(false);
      }
    };

    checkAdminRights();
    return () => { isMounted = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoadingRooms(false);
      return;
    }

    setLoadingRooms(true);
    const unsubscribeRooms = firestore()
      .collection('voice_rooms')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const fetchedRooms: VoiceRoom[] = [];
          snapshot?.docs?.forEach(doc => {
            fetchedRooms.push({
              id: doc.id,
              ...doc.data(),
            } as VoiceRoom);
          });
          setRooms(fetchedRooms);
          setLoadingRooms(false);
        },
        error => {
          console.error('Firestore Fetch Error:', error);
          setLoadingRooms(false);
        }
      );

    return () => unsubscribeRooms();
  }, [currentUser]);

  // Listen to who is inside every listed room
  const roomIdsKey = rooms.map(r => r.id).join('|');
  useEffect(() => {
    if (!currentUser || !roomIdsKey) return;
    const ids = roomIdsKey.split('|');
    const unsubs = ids.map(id =>
      firestore()
        .collection('voice_rooms')
        .doc(id)
        .collection('participants')
        .onSnapshot(
          snap => {
            const map: Record<string, number | null> = {};
            snap?.docs?.forEach(d => {
              const ls: any = d.data()?.lastSeen;
              // lastSeen is null for a write that has not reached the server yet = just joined
              map[d.id] = ls && typeof ls.toMillis === 'function' ? ls.toMillis() : null;
            });
            presenceDocsRef.current[id] = map;
            setPresenceTick(n => n + 1);
          },
          () => {}
        )
    );
    return () => unsubs.forEach(u => u());
  }, [roomIdsKey, currentUser]);

  // Recount every 20 seconds so people who closed the app drop out
  useEffect(() => {
    const recount = () => {
      const now = Date.now();
      const next: Record<string, number> = {};
      Object.keys(presenceDocsRef.current).forEach(id => {
        next[id] = Object.values(presenceDocsRef.current[id]).filter(
          ms => ms === null || now - (ms as number) < 70 * 1000
        ).length;
      });
      setLiveCounts(next);
    };
    recount();
    const timer = setInterval(recount, 20 * 1000);
    return () => clearInterval(timer);
  }, [presenceTick]);

  useEffect(() => {
    const targetRoomId = route?.params?.roomId;
    if (targetRoomId) {
      setHighlightedRoomId(targetRoomId);
      const timer = setTimeout(() => setHighlightedRoomId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [route?.params?.roomId]);

  const handleTabChange = (tab: 'public' | 'official') => {
    setActiveTab(tab);
  };

  // 🔑 THE ACTUAL FIX: previously, scrolling the pager to match the tapped
  // tab happened INLINE inside handleTabChange, in the same call as
  // setActiveTab. That scrollTo() call would occasionally silently no-op
  // (pagerRef not yet attached / ScrollView mid-layout right after the
  // loading spinner disappears), leaving `activeTab` saying "official"
  // while the ScrollView was still physically sitting on page 0 (Study
  // Rooms). Result: "Class Rooms" header + empty-state text, but Study
  // Room cards still visible underneath — until you tapped the tab again
  // and the scrollTo happened to succeed.
  //
  // Now the scroll is driven by a dedicated effect that re-runs on every
  // `activeTab` change (tap OR anything else that sets it), so the pager
  // position and the header text can never drift apart.
  useEffect(() => {
    const targetIndex = activeTab === 'public' ? 0 : 1;
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: targetIndex * SCREEN_WIDTH, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, remountSignal]);

  const handleScrollEnd = (e: any) => {
    const xOffset = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(xOffset / SCREEN_WIDTH);
    const targetTab = pageIndex === 0 ? 'public' : 'official';
    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  };

  const openCreateModal = () => {
    if (activeTab === 'official' && audioRole === 'teacher') {
      // Teachers create their group audio class from here
      setClassModalOpen(true);
      return;
    }
    if (activeTab === 'official' && !isAdminOrSubAdmin) {
      Alert.alert('Restricted', 'Only Admins & Sub-Admins can create Class Rooms.');
      return;
    }
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setRoomTitle('');
    setRoomCategory('General English');
  };

  const handleInitiateCreateRoom = () => {
    if (!roomTitle.trim()) {
      Alert.alert('Required', 'Please enter a room title');
      return;
    }
    // 🐛 ROOT-CAUSE FIX: pehle yahan sirf avatar-picker modal khulta tha,
    // "Create Room" title-form wala `isModalVisible` overlay band NAHI
    // hota tha — wo sirf BAAD me `handleProceedCreateRoom` ke poori tarah
    // SUCCESS hone par `closeModal()` se band hota tha. Agar us async
    // step ke beech kahin bhi (network, error) kuch atak jaaye, to ye
    // poori-screen-cover karne wala overlay HAMESHA ke liye khula reh
    // jaata — chahe upar call UI dikhta rahe (usse dhak jaata tha), call
    // khatam hote hi ye "stuck" overlay surface ho jaata aur SAARE touches
    // khud absorb kar leta (screen "dead" lagti), chahe khud blank/white
    // hi kyun na dikhe.
    setIsModalVisible(false);
    setPendingJoinRoom(null);
    setShowAvatarPickerModal(true);
  };

  const handleProceedCreateRoom = async (chosenAvatarUrl: string) => {
    try {
      setCreating(true);
      setShowAvatarPickerModal(false);

      const newRoomRef = firestore().collection('voice_rooms').doc();
      const roomId = newRoomRef.id;
      const livekitRoomName = `room_${roomId}`;
      const participantName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

      const isPublicType = activeTab === 'public';
      const selectedType: 'public' | 'official' = isPublicType ? 'public' : 'official';

      // 🆕 CREATE-ONLY FLOW: pehle yahan room create hote hi turant
      // token fetch karke seedha call screen me navigate ho jaate the
      // (auto-join). Ab creator turant join NAHI hota — room sirf
      // Firestore me ek "not yet joined" entry ki tarah create hota hai,
      // list me dikhta hai, aur creator baad me normal "join" flow
      // (`handleInitiateJoinRoom` → `handleProceedJoinRoom`) se hi
      // andar jaata hai, bilkul kisi aur participant ki tarah.
      //
      // Isi liye `totalParticipants`/`activeSpeakersCount` ab 0 se
      // start hote hain — abhi tak koi actually LiveKit room me connect
      // nahi hua hai.
      const roomData: Partial<VoiceRoom> = {
        title: roomTitle.trim(),
        category: roomCategory.trim() || 'General English',
        hostName: participantName,
        activeSpeakersCount: 0,
        totalParticipants: 0,
        livekitRoomId: livekitRoomName,
        createdBy: currentUser?.uid || '',
        type: selectedType,
        maxLimit: isPublicType ? 10 : 9999,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await newRoomRef.set(roomData);

      setCreating(false);
      closeModal();
    } catch (error: any) {
      setCreating(false);
      console.error('Create Room Error:', error);
      Alert.alert('Error', error.message || 'Failed to create room.');
    }
  };

  // Share a public room through the phone's share sheet
  const handleShareRoom = async (item: VoiceRoom) => {
    try {
      await Share.share({
        message:
          `Join "${item.title}" live on ECC - English Conversation Club 🎧\n` +
          `https://ecc-master-english-fa596.web.app/room/${item.id}`,
      });
    } catch (e) {
      console.log('Share room error:', e);
    }
  };

  const handleInitiateJoinRoom = (item: VoiceRoom) => {
    if (item.type === 'public' && (liveCounts[item.id] || 0) >= 10) {
      Alert.alert('Room Full', 'This public study room has reached its maximum limit of 10 users.');
      return;
    }
    setPendingJoinRoom(item);
    setShowAvatarPickerModal(true);
  };

  const handleProceedJoinRoom = async (chosenAvatarUrl: string) => {
    if (!pendingJoinRoom) return;
    try {
      setIsJoiningPending(true);
      setShowAvatarPickerModal(false);

      const participantName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

      // One Cloud Function gives the token for BOTH room types. The server checks:
      //  - Study Room (public): login is enough.
      //  - Class Room (official): active Audio plan (or admin / sub-admin / creator).
      let data: any;
      try {
        const res: any = await functions().httpsCallable('getLiveKitToken')({
          roomName: pendingJoinRoom.livekitRoomId,
          participantName,
        });
        data = { token: res.data?.token, serverUrl: LIVEKIT_FALLBACK_URL };
      } catch (e: any) {
        const code = e?.code || '';
        if (
          pendingJoinRoom.type === 'official' &&
          (code === 'functions/permission-denied' || code === 'permission-denied')
        ) {
          setIsJoiningPending(false);
          Alert.alert(
            'Audio Plan Required',
            'Group classes are included in the Audio Mode plan. Choose a plan to join.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'View Plans',
                onPress: () => navigation.navigate('ProgramFlowScreen', { mode: 'audio' }),
              },
            ]
          );
          return;
        }
        if (code === 'functions/not-found' || code === 'not-found') {
          throw new Error('This room is no longer available.');
        }
        throw new Error('Could not connect to the room. Please check your internet and try again.');
      }
      if (!data.token) throw new Error('Failed to get the room token.');

      setIsJoiningPending(false);

      // Start the call directly (no extra "starter" screen). Pushing a screen and popping it again
      // right away left the app on a blank white screen behind the minimized bubble.
      // The server already checked the Audio plan when it gave the token.
      startCall({
        serverUrl: data.serverUrl || LIVEKIT_FALLBACK_URL,
        token: data.token,
        roomType: pendingJoinRoom.type === 'official' ? 'class' : 'study',
        roomTitle: pendingJoinRoom.title,
        isHost: pendingJoinRoom.createdBy === currentUser?.uid,
        roomId: pendingJoinRoom.id,
        userAvatarUrl: chosenAvatarUrl || currentUser?.photoURL || '',
      });
    } catch (error: any) {
      setIsJoiningPending(false);
      console.error('Join Room Error:', error);
      Alert.alert('Error', error.message || 'Unable to join the room.');
    }
  };

  const publicRooms = rooms.filter(r => r.type === 'public' || !r.type);
  const officialRooms = rooms.filter(r => r.type === 'official');
  const roomDataListHasOfficial = officialRooms.length > 0;
  const canCreateInCurrentTab = activeTab === 'public' || (activeTab === 'official' && (isAdminOrSubAdmin || audioRole === 'teacher'));

  const renderRoomList = (roomDataList: VoiceRoom[], isOfficialTab: boolean) => (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
      <FlatList
        data={roomDataList}
        keyExtractor={item => item.id}
        ListHeaderComponent={isOfficialTab ? renderAudioClasses() : null}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const liveCount = liveCounts[item.id] || 0;
          const isFull = item.type === 'public' && liveCount >= 10;
          const isTargeted = item.id === highlightedRoomId;
          const borderBlink = blinkAnim.interpolate({
            inputRange: [0, 1],
            outputRange: isDarkMode
              ? ['rgba(56, 189, 248, 0.25)', 'rgba(56, 189, 248, 1)']
              : ['#E2E8F0', '#38BDF8'],
          });

          return (
            <AnimatedTouchable
              style={[
                styles.roomCardGlow,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: isTargeted ? '#0284C7' : borderBlink,
                },
                isTargeted && styles.roomCardTargetedGlow,
              ]}
              activeOpacity={0.88}
              onPress={() => handleInitiateJoinRoom(item)}
            >
              <View style={styles.roomCardHeader}>
                <View
                  style={[
                    styles.liveBadgeGlow,
                    { backgroundColor: isFull ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)' },
                  ]}
                >
                  <Animated.View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isFull ? '#EF4444' : '#EF4444',
                      marginRight: 6,
                      opacity: blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                    }}
                  />
                  <Text
                    style={[
                      styles.liveBadgeText,
                      { color: isFull ? '#EF4444' : '#10B981' },
                    ]}
                  >
                    {isFull ? 'FULL' : (currentLang === 'hi' ? 'लाइव' : 'LIVE')}
                  </Text>
                </View>

                {item.type === 'public' && (
                  <TouchableOpacity
                    onPress={() => handleShareRoom(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginLeft: 'auto', marginRight: 8, padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Share2 color={isDarkMode ? '#38BDF8' : '#0284C7'} size={17} />
                  </TouchableOpacity>
                )}

                <View
                  style={[
                    styles.listenerCountContainer,
                    {
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.75)' : '#F8FAFC',
                      borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : '#E2E8F0',
                    },
                  ]}
                >
                  <Users color={isDarkMode ? '#38BDF8' : '#0284C7'} size={13} />
                  <Text style={[styles.listenerCountText, { color: colors.textPrimary }]}>
                    {liveCount}{item.type === 'public' ? '/10' : ''} {t?.rooms?.listening || 'listening'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardContentContainer}>
                <View style={styles.leftColumn}>
                  <Text style={[styles.roomTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.roomHost, { color: colors.textSecondary }]}>
                    Hosted by{' '}
                    <Text style={[styles.boldHostText, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]}>
                      {item.hostName || 'User'}
                    </Text>
                  </Text>
                </View>
              </View>

              <View style={[styles.roomCardFooter, { borderTopColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : '#F1F5F9' }]}>
                <View style={styles.tagsContainer}>
                  <View
                    style={[
                      styles.neonTag,
                      {
                        backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF',
                        borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.35)' : '#BAE6FD',
                      },
                    ]}
                  >
                    <Sparkles size={11} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 4 }} />
                    <Text
                      style={[
                        styles.neonTagText,
                        { color: isDarkMode ? '#38BDF8' : '#0284C7' },
                      ]}
                    >
                      {item.category || 'General'}
                    </Text>
                  </View>
                </View>

                <View style={styles.glowArrowButton}>
                  <ChevronRight color="#FFFFFF" size={17} strokeWidth={2.8} />
                </View>
              </View>
            </AnimatedTouchable>
          );
        }}
        ListEmptyComponent={
          isOfficialTab && audioSessions.length > 0 ? null : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isOfficialTab
                ? 'There is currently no active official classroom.'
                : 'No study group is active. Create the first room!'}
            </Text>
          </View>
          )
        }
      />
    </View>
  );

  return (
    <View key={remountSignal} style={styles.rootWrapper}>
      {/* 🌟 Dynamic Background: Light me room2-p2.png & Dark me room2.png */}
      <ImageBackground
        source={
          isDarkMode
            ? require('../../../assets/room2.png')
            : require('../../../assets/room2-p2.png')
        }
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <SafeAreaView
        style={[
          styles.safeAreaWrapper,
          {
            backgroundColor: isDarkMode
              ? 'rgba(7, 13, 27, 0.65)'
              : 'rgba(255, 255, 255, 0.55)',
          },
        ]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />

        {/* ─── HEADER ─── */}
        <View style={styles.fixedHeader}>
          <View style={styles.headerTopRow}>
            {navigation?.canGoBack() && (
              <TouchableOpacity
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.75)' : '#FFFFFF',
                    borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#E2E8F0',
                  },
                ]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <ChevronLeft size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.headerBadgePill,
                  {
                    backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
                    borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                  },
                ]}
              >
                <Radio size={12} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
                <Text
                  style={[
                    styles.headerBadgePillText,
                    { color: isDarkMode ? '#38BDF8' : '#0284C7' },
                  ]}
                >
                  LIVE AUDIO SPACES
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t?.rooms?.title || 'Voice Rooms'}
              </Text>
            </View>
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t?.rooms?.subtitle || 'Connect with learners & speak fluently in real time'}
          </Text>

          {/* Tab Control: Talk Rooms (public) / Trainer Room (private) */}
          <View
            style={[
              styles.tabBarContainer,
              {
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : '#F3F7FD',
                borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.2)' : '#DCE6F5',
              },
            ]}
          >
            {([
              { key: 'public', title: 'Talk Rooms', sub: 'Public rooms', Icon: Users },
              { key: 'official', title: 'Trainer Room', sub: 'Private rooms', Icon: GraduationCap },
            ] as const).map(({ key, title, sub, Icon }) => {
              const active = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.tabButton,
                    styles.tabButtonRow,
                    active && [styles.activeTabButton, { backgroundColor: isDarkMode ? '#2563EB' : '#0A6CF2' }],
                  ]}
                  onPress={() => handleTabChange(key)}
                  activeOpacity={0.85}
                >
                  <Icon size={20} color={active ? '#FFFFFF' : isDarkMode ? '#93C5FD' : '#1E3A5F'} />
                  <View style={{ marginLeft: 8, flexShrink: 1 }}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[styles.tabTitleText, { color: active ? '#FFFFFF' : colors.textPrimary }]}
                    >
                      {title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.tabSubText, { color: active ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}
                    >
                      {sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── SECTION HEADER BAR ─── */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              {activeTab === 'public' ? 'Active Talk Rooms' : 'Active Trainer Rooms'}
            </Text>
            <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
              {activeTab === 'public' ? 'Join live conversations and meet other learners' : 'Join live classes led by your trainer'}
            </Text>
          </View>

          {canCreateInCurrentTab && (
            <Animated.View style={{ opacity: glowAnim }}>
              <TouchableOpacity
                style={styles.glowingCreateBtn}
                onPress={openCreateModal}
                activeOpacity={0.85}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.glowingCreateBtnText}>{activeTab === 'official' && audioRole === 'teacher' && !isAdminOrSubAdmin ? 'Create Class' : 'Create Room'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* ─── TOUCH SWIPE TO SLIDE PAGER ─── */}
        {loadingRooms || checkingRole || isJoiningPending ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            {isJoiningPending && (
              <Text style={{ marginTop: 10, color: colors.textSecondary, fontWeight: '600' }}>
                Connecting to Voice Room...
              </Text>
            )}
          </View>
        ) : (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            contentOffset={{ x: activeTab === 'official' ? SCREEN_WIDTH : 0, y: 0 }}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            {/* Page 0: Study Rooms */}
            {renderRoomList(publicRooms, false)}

            {/* Page 1: Class Rooms */}
            {renderRoomList(officialRooms, true)}
          </ScrollView>
        )}

        {/* ─── CREATE GROUP AUDIO CLASS (teachers) ─── */}
        {classModalOpen && (
          <View style={styles.customModalOverlay}>
            <Pressable style={styles.overlayBackground} onPress={() => setClassModalOpen(false)} />
            <View style={[styles.customModalCard, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', maxHeight: '88%' }]}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Group Audio Class</Text>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1', backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}
                  placeholder="e.g. Speaking practice: daily life"
                  placeholderTextColor="#64748B"
                  value={classTitle}
                  onChangeText={setClassTitle}
                  maxLength={80}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1', backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}
                  placeholder="What will students do in this class?"
                  placeholderTextColor="#64748B"
                  value={classDesc}
                  onChangeText={setClassDesc}
                  maxLength={500}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {classDays.map((d, i) => {
                    const active = i === classDayOffset;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setClassDayOffset(i)}
                        style={{ width: 52, paddingVertical: 8, marginRight: 8, borderRadius: 12, alignItems: 'center', backgroundColor: active ? '#0284C7' : (isDarkMode ? '#1E293B' : '#F1F5F9') }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#FFF' : colors.textSecondary }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: active ? '#FFF' : colors.textPrimary }}>{d.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Start time (24-hour, India time)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <TextInput
                    style={[styles.input, { width: 70, textAlign: 'center', marginBottom: 0, color: colors.textPrimary, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1', backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}
                    value={classHour}
                    onChangeText={(t) => setClassHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#64748B"
                  />
                  <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>:</Text>
                  <TextInput
                    style={[styles.input, { width: 70, textAlign: 'center', marginBottom: 0, color: colors.textPrimary, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1', backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}
                    value={classMin}
                    onChangeText={(t) => setClassMin(t.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#64748B"
                  />
                </View>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Duration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {[30, 45, 60, 90].map((dur) => {
                    const active = dur === classDuration;
                    return (
                      <TouchableOpacity
                        key={dur}
                        onPress={() => setClassDuration(dur)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: active ? '#0284C7' : (isDarkMode ? '#1E293B' : '#F1F5F9') }}
                      >
                        <Text style={{ fontWeight: '700', color: active ? '#FFF' : colors.textPrimary }}>{dur} min</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Maximum students</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1', backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}
                  value={classSeats}
                  onChangeText={(t) => setClassSeats(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                />

                <TouchableOpacity
                  onPress={submitClass}
                  disabled={classSaving}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#0284C7', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 6 }}
                >
                  {classSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Create class</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setClassModalOpen(false)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}

        {/* ─── CREATE ROOM DETAILS MODAL ─── */}
        {isModalVisible && (
          <View style={styles.customModalOverlay}>
            <Pressable style={styles.overlayBackground} onPress={closeModal} />
            <View style={[styles.customModalCard, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Create {activeTab === 'public' ? 'Study' : 'Class'} Room
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Room Title</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1',
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  },
                ]}
                placeholder="e.g. English Grammar Group Discussion"
                placeholderTextColor="#64748B"
                value={roomTitle}
                onChangeText={setRoomTitle}
                autoFocus={true}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1',
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  },
                ]}
                placeholder="e.g. IELTS / Practice / Debate"
                placeholderTextColor="#64748B"
                value={roomCategory}
                onChangeText={setRoomCategory}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={closeModal}
                  disabled={creating}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#0284C7' }]}
                  onPress={handleInitiateCreateRoom}
                  disabled={creating}
                >
                  <Text style={styles.submitBtnText}>Next: Choose Avatar ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ─── ILLUSTRATED AVATAR PICKER MODAL ─── */}
        <Modal
          visible={showAvatarPickerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAvatarPickerModal(false)}
        >
          <View style={styles.avatarModalOverlay}>
            <Pressable style={styles.overlayBackground} onPress={() => setShowAvatarPickerModal(false)} />
            <View style={[styles.avatarModalBox, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}>
              <View style={styles.avatarModalTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={20} color="#38BDF8" />
                  <Text style={[styles.avatarModalTitle, { color: colors.textPrimary }]}>
                    Select Profile Avatar (Optional)
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowAvatarPickerModal(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>
                Choosing an avatar is optional - you can skip it. Tap a selected avatar again to remove it.
              </Text>

              <ScrollView contentContainerStyle={styles.avatarGridContainer}>
                {ILLUSTRATED_AVATARS.map(item => {
                  const isSelected = selectedAvatarUrl === item.url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.avatarPickTile,
                        {
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        },
                        isSelected && styles.avatarPickTileActive,
                      ]}
                      onPress={() => setSelectedAvatarUrl(isSelected ? '' : item.url)}
                      activeOpacity={0.75}
                    >
                      <Image source={{ uri: item.url }} style={styles.avatarVectorImg} resizeMode="contain" />
                      <Text style={[styles.avatarLabel, { color: isSelected ? '#0284C7' : colors.textSecondary }]}>
                        {item.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.avatarCheckmarkPill}>
                          <UserCheck size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmAvatarBtn, { backgroundColor: '#0284C7' }]}
                onPress={() => {
                  if (pendingJoinRoom) {
                    handleProceedJoinRoom(selectedAvatarUrl);
                  } else {
                    handleProceedCreateRoom(selectedAvatarUrl);
                  }
                }}
                disabled={creating || isJoiningPending}
                activeOpacity={0.85}
              >
                {creating || isJoiningPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmAvatarBtnText}>
                    {pendingJoinRoom
                      ? (selectedAvatarUrl ? 'Enter Voice Room 🚀' : 'Skip & Enter Room 🚀')
                      : 'Create & Join Room 🚀'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
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
  safeAreaWrapper: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: (STATUSBAR_HEIGHT || 0) + 10,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end', // back button sits on the same line as the title text
    gap: 12,
  },
  headerBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  headerBadgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    marginTop: 10,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  tabTitleText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tabSubText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  scrollContent: {
    paddingBottom: 150, // keeps the last card clear of the floating bottom tab bar
    paddingTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  glowingCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0A6CF2',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 22,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.2,
    borderColor: '#7DD3FC',
  },
  glowingCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
  roomCardGlow: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  roomCardTargetedGlow: {
    borderWidth: 2,
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBadgeGlow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  listenerCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  listenerCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  leftColumn: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  roomHost: {
    fontSize: 12.5,
    marginTop: 4,
    fontWeight: '500',
  },
  boldHostText: {
    fontWeight: '800',
  },
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  neonTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  neonTagText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  glowArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  customModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  customModalCard: {
    width: '88%',
    maxWidth: 380,
    padding: 22,
    borderRadius: 24,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  cancelBtn: {
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  avatarModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  avatarModalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    padding: 20,
    elevation: 12,
    maxHeight: 520,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  avatarModalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  avatarGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  avatarPickTile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1.8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 8,
  },
  avatarPickTileActive: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
  },
  avatarVectorImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  avatarCheckmarkPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#0284C7',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmAvatarBtn: {
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    elevation: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  confirmAvatarBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});