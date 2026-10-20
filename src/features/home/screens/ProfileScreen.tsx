import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  Settings,
  Award,
  Download,
  Flame,
  Users,
  Trophy,
  LogOut,
  Volume2,
  FileText,
  BookOpen,
  Zap,
} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';
import ProfilePhoto from './ProfilePhoto';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 24);

const IMG_PROFILE_BG = require('../../../assets/profile.png');

// ─── MASTER BADGES MAPPING ───
const ALL_AVAILABLE_BADGES: {
  [key: string]: {
    labelKey: string;
    labelDefault: string;
    icon: React.JSX.Element;
  };
} = {
  streak_12: {
    labelKey: 'streak12',
    labelDefault: '12-Day Streak',
    icon: <Flame size={20} color="#F59E0B" />,
  },
  rooms_50: {
    labelKey: 'rooms50',
    labelDefault: '50 Rooms',
    icon: <Users size={20} color="#38BDF8" />,
  },
  top_10: {
    labelKey: 'top10',
    labelDefault: 'Top 10%',
    icon: <Trophy size={20} color="#EAB308" />,
  },
};

export default function ProfileScreen({ navigation }: any) {
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? true;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth().currentUser;

  // Sign Out Handler
  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out from your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth().signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Something went wrong');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        doc => {
          const isDocExist = typeof doc?.exists === 'function' ? doc.exists() : Boolean(doc?.exists);
          if (isDocExist) {
            setUserData(doc.data());
          } else {
            setUserData({
              name: currentUser.displayName || 'Saad Sidd',
              xp: 30,
              streak: 0,
              roomsJoined: 0,
              level: 'B2',
              status: 'Intermediate',
              isPremium: true,
              joinedDate: '2026',
              pronunciation: '0%',
              grammar: '0%',
              vocabulary: '0%',
              fluency: '0%',
              badges: [],
            });
          }
          setLoading(false);
        },
        error => {
          console.error('Profile fetch error:', error);
          setLoading(false);
        },
      );

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#060813' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  const rawName = userData?.fullName || userData?.name || currentUser?.displayName || 'Saad Sidd';
  const displayName = rawName;

  const liveProgressData = [
    { label: 'Pronunciation', value: userData?.pronunciation || '0%', icon: <Volume2 size={16} color="#A855F7" />, iconBg: isDarkMode ? '#2E1065' : '#F3E8FF', barColor: '#A855F7' },
    { label: 'Grammar', value: userData?.grammar || '0%', icon: <FileText size={16} color="#38BDF8" />, iconBg: isDarkMode ? '#082F49' : '#E0F2FE', barColor: '#38BDF8' },
    { label: 'Vocabulary', value: userData?.vocabulary || '0%', icon: <BookOpen size={16} color="#2DD4BF" />, iconBg: isDarkMode ? '#042F2E' : '#CCFBF1', barColor: '#2DD4BF' },
    { label: 'Fluency', value: userData?.fluency || '0%', icon: <Zap size={16} color="#F97316" />, iconBg: isDarkMode ? '#431407' : '#FFEDD5', barColor: '#F97316' },
  ];

  const activeUserBadges = Array.isArray(userData?.badges)
    ? userData.badges.filter((bKey: string) => ALL_AVAILABLE_BADGES[bKey])
    : [];

  const currentXp = userData?.xp ?? 30;
  const roomsCount = userData?.roomsJoined ?? 0;
  const streakCount = userData?.streak ?? 0;

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDarkMode ? '#060813' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* 🌌 AMBIENT TOP BACKGROUND GLOW ART */}
      <Image
        source={IMG_PROFILE_BG}
        style={[
          styles.profileBgImageOverlay,
          !isDarkMode && { opacity: 0.35 }
        ]}
        resizeMode="cover"
      />

      {/* ─── FIXED TOP HEADER ─── */}
      <View style={[styles.topHeaderBar, { paddingTop: STATUS_BAR_HEIGHT + 8 }]}>
        <Text style={[styles.headerTitleText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>My Profile</Text>
        
        {/* TOP RIGHT SETTINGS BUTTON */}
        <TouchableOpacity
          style={[styles.settingsGearCircle, { 
            backgroundColor: isDarkMode ? '#1E1B4B' : '#FFFFFF',
            borderColor: isDarkMode ? '#6366F1' : '#CBD5E1',
            shadowColor: isDarkMode ? '#8B5CF6' : '#000',
          }]}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.8}
        >
          <Settings size={20} color={isDarkMode ? '#FFFFFF' : '#475569'} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* ─── AVATAR WITH NEON CIRCULAR RING (tap to change photo) ─── */}
        <View style={styles.profileMetaWrapper}>
          <View style={[styles.avatarGlowContainer, {
            borderColor: '#8B5CF6',
            shadowColor: isDarkMode ? '#8B5CF6' : '#A855F7',
            backgroundColor: isDarkMode ? '#060813' : '#FFFFFF'
          }]}>
            {/* Tap the photo to add, change or remove your DP */}
            <ProfilePhoto size={100} name={rawName} accent="#6366F1" />
          </View>

          <Text style={[styles.profileName, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{displayName}</Text>
          {!!currentUser?.email && (
            <Text style={[styles.profileSubText, { color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }]}>
              {currentUser.email}
            </Text>
          )}
          <Text style={[styles.profileSubText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Joined <Text style={{ color: '#818CF8', fontWeight: '800' }}>2026</Text>
          </Text>
        </View>

        {/* ─── 1. STATS CARD ROW (Star, Users, Flame) ─── */}
        <View style={[styles.statsCardContainer, { 
          backgroundColor: isDarkMode ? 'rgba(13, 17, 34, 0.95)' : '#FFFFFF',
          borderColor: isDarkMode ? '#1E1B4B' : '#E2E8F0',
          shadowColor: isDarkMode ? '#8B5CF6' : '#000000',
        }]}>
          {/* XP Stat Item */}
          <View style={styles.statBoxItem}>
            <View style={[styles.statIconBadgePurple, { backgroundColor: isDarkMode ? '#7C3AED' : '#9333EA' }]}>
              <Text style={styles.exactStarIconText}>★</Text>
            </View>
            <Text style={[styles.statNumberText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{currentXp}</Text>
            <Text style={[styles.statLabelText, { color: '#C084FC' }]}>XP</Text>
          </View>

          <View style={[styles.statDividerVertical, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} />

          {/* Rooms Joined Stat Item */}
          <View style={styles.statBoxItem}>
            <View style={[styles.statIconBadgeBlue, { backgroundColor: isDarkMode ? '#2563EB' : '#3B82F6' }]}>
              <Users size={16} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <Text style={[styles.statNumberText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{roomsCount}</Text>
            <Text style={[styles.statLabelText, { color: '#60A5FA' }]}>Rooms joined</Text>
          </View>

          <View style={[styles.statDividerVertical, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} />

          {/* Day Streak Stat Item */}
          <View style={styles.statBoxItem}>
            <View style={[styles.statIconBadgeOrange, { backgroundColor: isDarkMode ? '#EA580C' : '#F97316' }]}>
              <Flame size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.statNumberText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{streakCount}</Text>
            <Text style={[styles.statLabelText, { color: '#F97316' }]}>Day streak</Text>
          </View>
        </View>

        {/* ─── 2. SPEAKING PROGRESS BLOCK ─── */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.bulletIndicator} />
          <Text style={[styles.sectionHeaderTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>Speaking Progress</Text>
        </View>

        <View style={[styles.progressCardContainer, { 
          backgroundColor: isDarkMode ? 'rgba(13, 17, 34, 0.95)' : '#FFFFFF',
          borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.22)' : '#E2E8F0',
          shadowColor: isDarkMode ? '#000' : '#E2E8F0'
        }]}>
          {liveProgressData.map((item, idx) => (
            <View key={idx} style={styles.progressRowItem}>
              <View style={[styles.progressIconBox, { backgroundColor: item.iconBg }]}>
                {item.icon}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressNameText, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>{item.label}</Text>
                  {/* Phase 2: real scores will replace this. Until then every row says Coming Soon. */}
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: item.barColor + '22' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: item.barColor }}>Coming Soon</Text>
                  </View>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' }]} />
              </View>
            </View>
          ))}
        </View>

        {/* ─── 3. ACHIEVEMENTS & BADGES BLOCK ─── */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.bulletIndicator} />
          <Text style={[styles.sectionHeaderTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>Achievements & Badges</Text>
        </View>

        {activeUserBadges.length === 0 ? (
          <View style={[styles.emptyBadgesCard, { 
            backgroundColor: isDarkMode ? 'rgba(13, 17, 34, 0.7)' : '#FFFFFF',
            borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.25)' : '#E2E8F0'
          }]}>
            <View style={styles.badgeLockedIconCircle}>
              <Trophy size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.emptyBadgesMainText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              No badges unlocked yet. <Text style={styles.emptyBadgesSubText}>Keep practicing!</Text>
            </Text>
          </View>
        ) : (
          <View style={styles.badgesGridContainer}>
            {activeUserBadges.map((badgeKey: string) => {
              const badge = ALL_AVAILABLE_BADGES[badgeKey];
              return (
                <View key={badgeKey} style={[styles.badgeCardItem, { 
                  backgroundColor: isDarkMode ? '#0D1122' : '#FFFFFF',
                  borderColor: isDarkMode ? '#1E1B4B' : '#E2E8F0'
                }]}>
                  <View style={styles.badgeIconBox}>{badge.icon}</View>
                  <Text style={[styles.badgeCardLabel, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{badge.labelDefault}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── 4. CERTIFICATES BLOCK ─── */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.bulletIndicator} />
          <Text style={[styles.sectionHeaderTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>Certificates</Text>
        </View>

        <View style={[styles.certificateRowBox, { 
          backgroundColor: isDarkMode ? 'rgba(13, 17, 34, 0.95)' : '#FFFFFF',
          borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.25)' : '#E2E8F0',
          shadowColor: isDarkMode ? '#000' : '#E2E8F0'
        }]}>
          <View style={styles.certIconPillWrap}>
            <Award size={20} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.certMainTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>Fluency Certificate</Text>
            <Text style={[styles.certSubTitle, { color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }]}>
              Coming Soon • Keep practicing to earn yours
            </Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(139, 92, 246, 0.15)' }}>
            <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#8B5CF6', letterSpacing: 0.4 }}>SOON</Text>
          </View>
        </View>

        {/* ─── 5. SIGN OUT ACCOUNT BUTTON ─── */}
        <TouchableOpacity 
          style={[styles.signOutActionPill, {
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
            borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FECACA'
          }]} 
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <LogOut size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.signOutActionText}>Sign Out Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    position: 'relative',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  profileBgImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: 180,
    zIndex: 0,
  },
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 50,
  },
  headerTitleText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  settingsGearCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    elevation: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 110,
    zIndex: 10,
  },

  /* AVATAR */
  profileMetaWrapper: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  avatarGlowContainer: {
    width: 108,
    height: 108,
    borderRadius: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarMainImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarMainCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMainText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  profileSubText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  /* 1. STATS CARD ROW */
  statsCardContainer: {
    borderRadius: 22,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 22,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  statBoxItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBadgePurple: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  exactStarIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  statIconBadgeBlue: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statIconBadgeOrange: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statDividerVertical: {
    width: 1,
    height: 52,
  },
  statNumberText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabelText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* SECTION HEADERS */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    gap: 8,
  },
  bulletIndicator: {
    width: 10,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#8B5CF6',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  /* 2. PROGRESS CARD */
  progressCardContainer: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 14,
    marginBottom: 20,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  progressRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  progressIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressValText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  /* 3. ACHIEVEMENTS & BADGES */
  emptyBadgesCard: {
    borderRadius: 22,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badgeLockedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyBadgesMainText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBadgesSubText: {
    color: '#A855F7',
    fontWeight: '900',
  },
  badgesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  badgeCardItem: {
    width: '31%',
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 12,
    alignItems: 'center',
  },
  badgeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* 4. CERTIFICATES */
  certificateRowBox: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  certIconPillWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certMainTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  certSubTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  blueCheckSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 3,
  },
  certDownloadCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* 5. SIGN OUT */
  signOutActionPill: {
    borderRadius: 18,
    borderWidth: 1.2,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  signOutActionText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
  },
});