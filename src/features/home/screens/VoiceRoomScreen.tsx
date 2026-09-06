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

import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  Users,
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
const TOKEN_SERVER_BASE_URL = 'https://livekit-token-server-2uvb.onrender.com';
const LIVEKIT_FALLBACK_URL = 'wss://eccapp-4hmra95b.livekit.cloud';

// 📱 Tablet / Large Screen Responsive Image Sizing
const IS_TABLET = SCREEN_WIDTH >= 600;
const MIC_IMG_SIZE = IS_TABLET ? 115 : 92;
const BOOK_IMG_SIZE = IS_TABLET ? 60 : 50;

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

export default function VoiceRoomScreen({ navigation, route }: any) {
  const themeHook = useTheme() as any;
  const t = themeHook?.t;
  const currentLang = themeHook?.currentLang || 'en';

  const [activeTab, setActiveTab] = useState<'public' | 'official'>('public');
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);

  const pagerRef = useRef<ScrollView>(null);

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [isAdminOrSubAdmin, setIsAdminOrSubAdmin] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(true);

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [roomCategory, setRoomCategory] = useState<string>('General English');
  const [creating, setCreating] = useState<boolean>(false);

  // Modal Animation Drivers
  const modalScaleAnim = useRef(new Animated.Value(0.85)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState<boolean>(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(ILLUSTRATED_AVATARS[0].url);
  const [pendingJoinRoom, setPendingJoinRoom] = useState<VoiceRoom | null>(null);
  const [isJoiningPending, setIsJoiningPending] = useState<boolean>(false);

  const currentUser = auth().currentUser;
  const isDarkMode = themeHook?.isDarkMode || false;

  const colors = isDarkMode
    ? {
        bgLight: '#070D1B',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        primary: '#38BDF8',
        bgCard: 'rgba(15, 23, 42, 0.90)',
        border: 'rgba(56, 189, 248, 0.35)',
      }
    : {
        bgLight: '#F8FAFC',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        primary: '#0284C7',
        bgCard: 'rgba(255, 255, 255, 0.95)',
        border: '#CBD5E1',
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
      try {
        const userEmail = currentUser.email?.toLowerCase().trim();
        const [adminSnap, subAdminSnap] = await Promise.all([
          firestore().collection('admins').where('email', '==', userEmail).get(),
          firestore().collection('sub_admins').where('email', '==', userEmail).get(),
        ]);

        if (isMounted) {
          setIsAdminOrSubAdmin(!adminSnap.empty || !subAdminSnap.empty);
        }
      } catch (error) {
        console.error('Error checking admin rights:', error);
        if (isMounted) setIsAdminOrSubAdmin(false);
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

  useEffect(() => {
    const targetRoomId = route?.params?.roomId;
    if (targetRoomId) {
      setHighlightedRoomId(targetRoomId);
      const timer = setTimeout(() => setHighlightedRoomId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [route?.params?.roomId]);

  const handleTabChange = (tab: 'public' | 'official', animateScroll: boolean = true) => {
    setActiveTab(tab);
    if (pagerRef.current && animateScroll) {
      const targetIndex = tab === 'public' ? 0 : 1;
      pagerRef.current.scrollTo({ x: targetIndex * SCREEN_WIDTH, animated: true });
    }
  };

  const handleScrollEnd = (e: any) => {
    const xOffset = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(xOffset / SCREEN_WIDTH);
    const targetTab = pageIndex === 0 ? 'public' : 'official';
    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  };

  // 🚀 Animated Modal Open & Close
  const openCreateModal = () => {
    if (activeTab === 'official' && !isAdminOrSubAdmin) {
      Alert.alert('Restricted', 'Only Admins & Sub-Admins can create Class Rooms.');
      return;
    }
    setIsModalVisible(true);
    Animated.parallel([
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalScaleAnim, {
        toValue: 0.85,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsModalVisible(false);
      setRoomTitle('');
      setRoomCategory('General English');
    });
  };

  const handleInitiateCreateRoom = () => {
    if (!roomTitle.trim()) {
      Alert.alert('Required', 'Please enter a room title');
      return;
    }
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

      const roomData: Partial<VoiceRoom> = {
        title: roomTitle.trim(),
        category: roomCategory.trim() || 'General English',
        hostName: participantName,
        activeSpeakersCount: 1,
        totalParticipants: 1,
        livekitRoomId: livekitRoomName,
        createdBy: currentUser?.uid || '',
        type: selectedType,
        maxLimit: 9999,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      const url = `${TOKEN_SERVER_BASE_URL}/getToken?roomName=${encodeURIComponent(
        livekitRoomName
      )}&participantName=${encodeURIComponent(participantName)}`;

      const response = await fetch(url);
      const responseText = await response.text();

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Server returned invalid response format.');
      }

      if (!response.ok || !data.token) {
        throw new Error(data?.error || `Server error with status ${response.status}`);
      }

      await newRoomRef.set(roomData);
      setCreating(false);
      closeModal();

      const targetScreen = selectedType === 'official' ? 'ClassRoomScreen' : 'StudyRoomScreen';
      navigation.navigate(targetScreen, {
        serverUrl: data.serverUrl || LIVEKIT_FALLBACK_URL,
        token: data.token,
        roomTitle: roomData.title,
        isHost: true,
        roomId: roomId,
        userAvatarUrl: chosenAvatarUrl,
      });
    } catch (error: any) {
      setCreating(false);
      console.error('Create Room Error:', error);
      Alert.alert('Error', error.message || 'Failed to connect to token server.');
    }
  };

  const handleInitiateJoinRoom = (item: VoiceRoom) => {
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

      const url = `${TOKEN_SERVER_BASE_URL}/getToken?roomName=${encodeURIComponent(
        pendingJoinRoom.livekitRoomId
      )}&participantName=${encodeURIComponent(participantName)}`;

      const response = await fetch(url);
      const responseText = await response.text();

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Server returned invalid response format.');
      }

      if (!response.ok || !data.token) {
        throw new Error(data?.error || 'Failed to fetch token');
      }

      const targetScreen = pendingJoinRoom.type === 'official' ? 'ClassRoomScreen' : 'StudyRoomScreen';
      setIsJoiningPending(false);

      navigation.navigate(targetScreen, {
        serverUrl: data.serverUrl || LIVEKIT_FALLBACK_URL,
        token: data.token,
        roomTitle: pendingJoinRoom.title,
        isHost: pendingJoinRoom.createdBy === currentUser?.uid,
        roomId: pendingJoinRoom.id,
        userAvatarUrl: chosenAvatarUrl,
      });
    } catch (error: any) {
      setIsJoiningPending(false);
      console.error('Join Room Error:', error);
      Alert.alert('Error', 'Unable to join room. Check token server.');
    }
  };

  const publicRooms = rooms.filter(r => r.type === 'public' || !r.type);
  const officialRooms = rooms.filter(r => r.type === 'official');
  const canCreateInCurrentTab = activeTab === 'public' || (activeTab === 'official' && isAdminOrSubAdmin);

  const displayRoomTitle = t?.rooms?.title || 'Voice Rooms';
  const displaySubtitle = t?.rooms?.subtitle || 'Practice live audio communication instantly';
  const displaySectionTitle = activeTab === 'public' ? 'Active Study Rooms' : 'Official Live Classes';

  const renderRoomList = (roomDataList: VoiceRoom[], isOfficialTab: boolean) => (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
      <FlatList
        data={roomDataList}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isFull = false;
          const isTargeted = item.id === highlightedRoomId;

          return (
            <TouchableOpacity
              style={[
                styles.roomCardDeepEmboss,
                isDarkMode ? styles.darkCardEmboss : styles.lightCardEmboss,
                isTargeted && styles.roomCardTargetedGlow,
              ]}
              activeOpacity={0.88}
              onPress={() => handleInitiateJoinRoom(item)}
            >
              <View style={[styles.cardSpecularRim, isDarkMode ? styles.darkCardRim : styles.lightCardRim]} />

              <View style={styles.roomCardHeader}>
                <View
                  style={[
                    styles.liveBadgeGlow,
                    { backgroundColor: isFull ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' },
                    isDarkMode ? styles.darkPillEmboss : styles.lightPillEmboss,
                  ]}
                >
                  <Volume2 color={isFull ? '#EF4444' : '#10B981'} size={13} style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.liveBadgeText,
                      { color: isFull ? '#EF4444' : '#10B981' },
                    ]}
                  >
                    {isFull ? 'FULL' : (currentLang === 'hi' ? 'लाइव' : 'LIVE')}
                  </Text>
                </View>

                <View
                  style={[
                    styles.listenerCountContainer,
                    isDarkMode ? styles.darkPillEmboss : styles.lightPillEmboss,
                  ]}
                >
                  <Users color={isDarkMode ? '#38BDF8' : '#0284C7'} size={13} />
                  <Text style={[styles.listenerCountText, { color: colors.textPrimary }]}>
                    {item.totalParticipants || 1} {t?.rooms?.listening || 'listening'}
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

              <View style={[styles.roomCardFooter, { borderTopColor: isDarkMode ? 'rgba(56, 189, 248, 0.2)' : 'rgba(203, 213, 225, 0.7)' }]}>
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
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isOfficialTab
                ? 'Abhi koi official class room active nahi hai.'
                : 'Koi study group active nahi hai. Aap pehla room create karein!'}
            </Text>
          </View>
        }
      />
    </View>
  );

  return (
    <View style={styles.rootWrapper}>
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
              : 'rgba(255, 255, 255, 0.40)',
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

          {/* 🎙️ 3D Metallic Mic Image (Responsive & Perfectly Sized like Reference) */}
          <View style={styles.headerMicContainer} pointerEvents="none">
            <Image
              source={require('../../../assets/voice-room.png')}
              style={styles.headerMicImg}
              resizeMode="contain"
            />
          </View>

          <View style={styles.centerHeaderContainer}>
            <View
              style={[
                styles.headerBadgePill,
                {
                  backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
                  borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.35)' : '#BAE6FD',
                },
              ]}
            >
              <Radio size={11} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
              <Text
                style={[
                  styles.headerBadgePillText,
                  { color: isDarkMode ? '#38BDF8' : '#0284C7' },
                ]}
              >
                LIVE AUDIO SPACES
              </Text>
            </View>

            {/* Title */}
            <View style={styles.embossWrapper}>
              <Text
                style={[
                  styles.embossBaseText,
                  styles.embossHighlightLayer,
                  { color: isDarkMode ? 'rgba(56, 189, 248, 0.6)' : '#FFFFFF' },
                ]}
              >
                {displayRoomTitle}
              </Text>

              <Text
                style={[
                  styles.embossBaseText,
                  styles.embossShadowLayer,
                  { color: isDarkMode ? '#020617' : 'rgba(0, 0, 0, 0.35)' },
                ]}
              >
                {displayRoomTitle}
              </Text>

              <Text
                style={[
                  styles.embossBaseText,
                  {
                    color: isDarkMode ? '#FFFFFF' : '#475569',
                    textShadowColor: isDarkMode ? '#38BDF8' : 'rgba(0, 0, 0, 0.5)',
                    textShadowOffset: isDarkMode ? { width: 0, height: 1 } : { width: 1, height: 1 },
                    textShadowRadius: isDarkMode ? 8 : 2,
                  },
                ]}
              >
                {displayRoomTitle}
              </Text>
            </View>

            {/* Subtitle */}
            <View
              style={[
                styles.subtitleEmbossCapsule,
                isDarkMode ? styles.subtitleDarkEmboss : styles.subtitleLightEmboss,
              ]}
            >
              <View style={styles.subtitleLayerWrapper}>
                <Text
                  style={[
                    styles.subtitleBaseText,
                    styles.subtitleHighlightLayer,
                    { color: isDarkMode ? 'rgba(56, 189, 248, 0.45)' : '#FFFFFF' },
                  ]}
                >
                  {displaySubtitle}
                </Text>

                <Text
                  style={[
                    styles.subtitleBaseText,
                    styles.subtitleShadowLayer,
                    { color: isDarkMode ? '#000000' : 'rgba(15, 23, 42, 0.35)' },
                  ]}
                >
                  {displaySubtitle}
                </Text>

                <Text
                  style={[
                    styles.subtitleBaseText,
                    {
                      color: isDarkMode ? '#E2E8F0' : '#334155',
                      textShadowColor: isDarkMode ? 'rgba(56, 189, 248, 0.8)' : '#FFFFFF',
                      textShadowOffset: isDarkMode ? { width: 0, height: 1 } : { width: -0.5, height: -0.5 },
                      textShadowRadius: isDarkMode ? 4 : 1,
                    },
                  ]}
                >
                  {displaySubtitle}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── 💎 TOP NAVIGATION TABS ─── */}
          <View
            style={[
              styles.tabBarContainer,
              {
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(238, 242, 246, 0.85)',
                borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.2)' : '#E2E8F0',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'public' && [
                  styles.activeTabButton,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                  },
                ],
              ]}
              onPress={() => handleTabChange('public')}
              activeOpacity={0.8}
            >
              <GraduationCap
                size={18}
                color={activeTab === 'public' ? '#0284C7' : '#64748B'}
                strokeWidth={2.5}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.tabTextRow}>
                <Text
                  style={[
                    styles.tabPrimaryText,
                    { color: activeTab === 'public' ? (isDarkMode ? '#38BDF8' : '#0284C7') : colors.textSecondary },
                  ]}
                >
                  Study Rooms{' '}
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'official' && [
                  styles.activeTabButton,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                  },
                ],
              ]}
              onPress={() => handleTabChange('official')}
              activeOpacity={0.8}
            >
              <Users
                size={17}
                color={activeTab === 'official' ? (isDarkMode ? '#38BDF8' : '#0284C7') : '#64748B'}
                strokeWidth={2.4}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === 'official' && { color: isDarkMode ? '#38BDF8' : '#0284C7', fontWeight: '800' },
                ]}
              >
                Class Rooms
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 🌟 SECTION CARD WITH REPLACED 3D BOOK.PNG IMAGE ─── */}
        <View style={styles.sectionHeaderRow}>
          <View
            style={[
              styles.sectionMainCard,
              isDarkMode ? styles.darkSectionCard : styles.lightSectionCard,
            ]}
          >
            <View style={styles.sectionCardContent}>
              {/* 📖 Real 3D Book Image Replaced Responsive */}
              <Image
                source={require('../../../assets/book.png')}
                style={styles.book3dImage}
                resizeMode="contain"
              />

              {/* Text Column with Dark Blue Heading */}
              <View style={styles.sectionCardTextCol}>
                <Text
                  style={[
                    styles.sectionHeadingClear,
                    { color: isDarkMode ? '#F8FAFC' : '#0A1931' },
                  ]}
                  numberOfLines={1}
                >
                  {displaySectionTitle}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitleClear,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                  numberOfLines={1}
                >
                  Tap or swipe between rooms
                </Text>
              </View>

              {/* Decorative Dot Matrix Grid */}
              <View style={styles.dotMatrixGrid}>
                {[...Array(6)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.matrixDot,
                      { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.4)' : '#93C5FD' },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {canCreateInCurrentTab && (
            <Animated.View style={{ opacity: glowAnim }}>
              <TouchableOpacity
                style={styles.glowingCreateBtn}
                onPress={openCreateModal}
                activeOpacity={0.85}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={3} />
                <Text style={styles.glowingCreateBtnText}>Create Room</Text>
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
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            {renderRoomList(publicRooms, false)}
            {renderRoomList(officialRooms, true)}
          </ScrollView>
        )}

        {/* ─── 🚀 ANIMATED CREATE ROOM DETAILS MODAL ─── */}
        <Modal
          visible={isModalVisible}
          transparent
          animationType="none"
          onRequestClose={closeModal}
        >
          <View style={styles.customModalOverlay}>
            <Pressable style={styles.overlayBackground} onPress={closeModal} />
            <Animated.View
              style={[
                styles.customModalCard,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                  opacity: modalOpacityAnim,
                  transform: [{ scale: modalScaleAnim }],
                },
              ]}
            >
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
            </Animated.View>
          </View>
        </Modal>

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
                    Select Profile Avatar
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowAvatarPickerModal(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>
                Choose your illustrated avatar. This avatar cannot be changed during the room session.
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
                      onPress={() => setSelectedAvatarUrl(item.url)}
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
                    {pendingJoinRoom ? 'Enter Voice Room 🚀' : 'Create & Join Room 🚀'}
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
    paddingTop: (STATUSBAR_HEIGHT || 0) + 8,
    paddingBottom: 8,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: (STATUSBAR_HEIGHT || 0) + 12,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
  },

  // 🎙️ Header Top Right Mic Image (Prominent & Balanced)
  headerMicContainer: {
    position: 'absolute',
    right: 8,
    top: (STATUSBAR_HEIGHT || 0) - 2,
    zIndex: 4,
  },
  headerMicImg: {
    width: MIC_IMG_SIZE,
    height: MIC_IMG_SIZE,
  },

  centerHeaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    marginTop: 2,
  },
  headerBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  headerBadgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  
  // Title
  embossWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  embossBaseText: {
    fontSize: 29,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  embossHighlightLayer: {
    position: 'absolute',
    top: -1.2,
    left: -1.2,
  },
  embossShadowLayer: {
    position: 'absolute',
    bottom: -1.5,
    right: -1.5,
  },

  // Subtitle
  subtitleEmbossCapsule: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleDarkEmboss: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  subtitleLightEmboss: {
    backgroundColor: '#EEF2F6',
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#94A3B8',
    borderRightColor: '#94A3B8',
    elevation: 3,
  },
  subtitleLayerWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleBaseText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitleHighlightLayer: {
    position: 'absolute',
    top: -1,
    left: -1,
  },
  subtitleShadowLayer: {
    position: 'absolute',
    bottom: -1,
    right: -1,
  },

  // Tab Bar
  tabBarContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    marginTop: 14,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  activeTabButton: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tabTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabSecondaryTag: {
    fontSize: 13,
    fontWeight: '900',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── SECTION CARD ───
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 12,
    gap: 10,
  },
  sectionMainCard: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.2,
    position: 'relative',
    overflow: 'hidden',
  },
  darkSectionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  lightSectionCard: {
    backgroundColor: '#E0E7FF',
    borderColor: '#C7D2FE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  sectionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 📖 3D Book Image (Smooth & Direct)
  book3dImage: {
    width: BOOK_IMG_SIZE,
    height: BOOK_IMG_SIZE,
    marginRight: 10,
  },

  sectionCardTextCol: {
    flex: 1,
  },
  sectionHeadingClear: {
    fontSize: 17.5,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionSubtitleClear: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  dotMatrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 20,
    gap: 4,
    marginLeft: 6,
  },
  matrixDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  glowingCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 22,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  glowingCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Room Cards
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 6,
  },
  roomCardDeepEmboss: {
    borderRadius: 24,
    padding: 17,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.8,
  },
  darkCardEmboss: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 7,
  },
  lightCardEmboss: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#94A3B8',
    borderRightColor: '#94A3B8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  darkCardRim: {
    backgroundColor: 'rgba(56, 189, 248, 0.5)',
  },
  lightCardRim: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  darkPillEmboss: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  lightPillEmboss: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  roomCardTargetedGlow: {
    borderWidth: 2.2,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.6,
    shadowRadius: 12,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
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