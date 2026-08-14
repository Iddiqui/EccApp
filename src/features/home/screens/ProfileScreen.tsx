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
import LinearGradient from 'react-native-linear-gradient';
import {
  Settings,
  Award,
  ChevronRight,
  Download,
  Flame,
  Mic,
  Sparkles,
  Trophy,
  GraduationCap,
  Crown,
  LogOut,
} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT =
  StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 24);

// ─── ENGLISH NAME TO HINDI CONVERTER HELPER ───
const toHindiName = (nameStr: string = '', lang: string = 'en') => {
  if (lang !== 'hi' || !nameStr) return nameStr;

  const nameMap: Record<string, string> = {
    'Saad Siddiqui': 'साद सिद्दीकी',
    'Jitendra Kumar': 'जितेन्द्र कुमार',
    'Aman Sharma': 'अमन शर्मा',
    'Sneha Patel': 'स्नेहा पटेल',
    'Rohit Verma': 'रोहित वर्मा',
    'ECC Learner': 'ईसीसी यूजर',
    'User': 'यूजर',
  };

  if (nameMap[nameStr.trim()]) {
    return nameMap[nameStr.trim()];
  }

  // Common replacements if exact match not found
  let res = nameStr;
  res = res.replace(/Saad/gi, 'साद');
  res = res.replace(/Siddiqui/gi, 'सिद्दीकी');
  res = res.replace(/User/gi, 'यूजर');
  return res;
};

// ─── MASTER BADGES MAPPING ───
const ALL_AVAILABLE_BADGES: {
  [key: string]: {
    labelKey: string;
    labelDefault: string;
    icon: React.JSX.Element;
    bgLight: string;
    bgDark: string;
  };
} = {
  streak_12: {
    labelKey: 'streak12',
    labelDefault: '12-डे स्ट्रिक',
    icon: <Flame size={24} color="#F59E0B" />,
    bgLight: '#FFF7ED',
    bgDark: '#451A03',
  },
  rooms_50: {
    labelKey: 'rooms50',
    labelDefault: '50 रूम्स',
    icon: <Mic size={24} color="#2563EB" />,
    bgLight: '#EFF6FF',
    bgDark: '#1E293B',
  },
  ai_master: {
    labelKey: 'aiMaster',
    labelDefault: 'एआई मास्टर',
    icon: <Sparkles size={24} color="#0D9488" />,
    bgLight: '#E6F4F1',
    bgDark: '#134E4A',
  },
  top_10: {
    labelKey: 'top10',
    labelDefault: 'टॉप 10%',
    icon: <Trophy size={24} color="#10B981" />,
    bgLight: '#E8F5E9',
    bgDark: '#064E3B',
  },
  ielts_ready: {
    labelKey: 'ieltsReady',
    labelDefault: 'आईईएलटीएस रेडी',
    icon: <GraduationCap size={24} color="#6366F1" />,
    bgLight: '#EEF2FF',
    bgDark: '#312E81',
  },
  club_legend: {
    labelKey: 'clubLegend',
    labelDefault: 'क्लब लेजेंड',
    icon: <Crown size={24} color="#F59E0B" />,
    bgLight: '#FFF7ED',
    bgDark: '#451A03',
  },
};

export default function ProfileScreen({ navigation }: any) {
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const t = themeContext?.t;
  const currentLang = themeContext?.currentLang || 'en';
  const colors = themeContext?.theme?.colors;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth().currentUser;

  // Sign Out Handler with Confirmation Alert
  const handleLogout = () => {
    Alert.alert(
      t?.profile?.signOut || 'साइन आउट',
      currentLang === 'hi'
        ? 'क्या आप वाकई अपने अकाउंट से लॉग आउट करना चाहते हैं?'
        : 'Are you sure you want to log out from your account?',
      [
        { text: currentLang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: t?.profile?.signOut || 'साइन आउट करें',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth().signOut();
            } catch (error: any) {
              Alert.alert(
                'लॉगआउट विफल',
                error.message || 'कुछ गलत हो गया',
              );
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
          if (doc.exists()) {
            setUserData(doc.data());
          } else {
            setUserData({
              name: currentUser.displayName || 'यूजर',
              xp: 0,
              streak: 0,
              roomsJoined: 0,
              level: 'B1',
              status: 'इंटरमीडिएट',
              isPremium: false,
              joinedDate: 'हाल ही में जॉइन किया',
              pronunciation: '0%',
              grammar: '0%',
              vocabulary: '0%',
              fluency: '0%',
              badges: [],
              rankText: 'टॉप --',
            });
          }
          setLoading(false);
        },
        error => {
          console.error('Profile sync dashboard error:', error);
          setLoading(false);
        },
      );

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.bgLight }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rawName =
    userData?.fullName ||
    userData?.name ||
    currentUser?.displayName ||
    'ECC Learner';

  // 🖼️ PROFILE PICTURE EXTRACTOR LOGIC
  const profilePhotoUrl = userData?.photoURL || currentUser?.photoURL;

  // 🌐 NAME TRANSLATED DYNAMICALLY TO HINDI IN HINDI MODE
  const displayName = toHindiName(rawName, currentLang);
  const avatarInitials = rawName.substring(0, 2).toUpperCase();
  const avatarBgColor = userData?.avatarBg || colors.primary;

  const liveProgressData = [
    {
      label: t?.profile?.pronunciation || 'प्रोनंसिएशन',
      value: userData?.pronunciation || '0%',
      color: '#10B981',
    },
    {
      label: t?.profile?.grammar || 'ग्रामर',
      value: userData?.grammar || '0%',
      color: colors.primary,
    },
    {
      label: t?.profile?.vocabulary || 'वोकैबुलरी',
      value: userData?.vocabulary || '0%',
      color: '#0D9488',
    },
    { 
      label: t?.profile?.fluency || 'फ्लूएंसी', 
      value: userData?.fluency || '0%', 
      color: '#F59E0B' 
    },
  ];

  const activeUserBadges = Array.isArray(userData?.badges)
    ? userData.badges.filter((bKey: string) => ALL_AVAILABLE_BADGES[bKey])
    : [];

  const currentXp = userData?.xp || 0;

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* ─── FIXED TOP GRADIENT HEADER BAR ─── */}
      <LinearGradient
        colors={['#2563EB', '#0D9488']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fixedTopBannerGradient}
      >
        <View style={styles.headerContentInline}>
          <Text style={styles.fixedHeaderTitle}>
            {t?.profile?.title || 'मेरी प्रोफाइल'}
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Settings size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main Scroll Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Profile Info Block */}
        <View style={styles.profileMetaWrapper}>
          <View
            style={[
              styles.avatarWrapperContainer,
              { backgroundColor: colors.bgCard },
            ]}
          >
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={styles.avatarMainImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.avatarMainCircle,
                  { backgroundColor: avatarBgColor },
                ]}
              >
                <Text style={styles.avatarMainText}>{avatarInitials}</Text>
              </View>
            )}
          </View>

          {userData?.isPremium && (
            <View
              style={[
                styles.premiumBadge,
                {
                  backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7',
                  borderColor: isDarkMode ? '#78350F' : '#FDE68A',
                },
              ]}
            >
              <Crown size={13} color="#D97706" />
              <Text style={styles.premiumText}>
                {currentLang === 'hi' ? 'प्रीमियम' : 'Premium'}
              </Text>
            </View>
          )}

          {/* DISPLAY NAME IN PURE HINDI */}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {displayName}
          </Text>
          <Text
            style={[styles.profileSubText, { color: colors.textSecondary }]}
          >
            {t?.profile?.joined || 'लेवल B2 · इंटरमीडिएट · 2026 में जॉइन किया'}
          </Text>
        </View>

        {/* Overview Stats Card Grid */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          {/* XP Stat Item */}
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {currentXp}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t?.profile?.xp || 'एक्सपी (XP)'}
            </Text>
          </View>

          <View
            style={[styles.verticalDivider, { backgroundColor: colors.border }]}
          />

          {/* Rooms Joined Stat Item */}
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {userData?.roomsJoined || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t?.profile?.roomsJoined || 'जॉइन किए गए रूम्स'}
            </Text>
          </View>

          <View
            style={[styles.verticalDivider, { backgroundColor: colors.border }]}
          />

          {/* Day Streak Stat Item */}
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
              {userData?.streak || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t?.profile?.dayStreak || 'डे स्ट्रिक'}
            </Text>
          </View>
        </View>

        {/* Core Metric Analytics Blocks */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.profile?.speakingProgress || 'स्पीकिंग प्रोग्रेस'}
        </Text>
        <View
          style={[
            styles.progressCardBlock,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          {liveProgressData.map((item, idx) => (
            <View key={idx} style={styles.progressRow}>
              <View style={styles.progressLabelRow}>
                <Text
                  style={[
                    styles.progressMetricName,
                    { color: colors.textPrimary },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.progressMetricValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {item.value}
                </Text>
              </View>
              <View
                style={[
                  styles.trackBg,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <View
                  style={[
                    styles.filledTrack,
                    {
                      width:
                        typeof item.value === 'number'
                          ? `${item.value}%`
                          : item.value,
                      backgroundColor: item.color || colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Badges Matrix Block */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.profile?.achievements || 'अचीवमेंट्स और बैजेस'}
        </Text>
        {activeUserBadges.length === 0 ? (
          <View
            style={[
              styles.emptyBadgesCard,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.emptyBadgesText, { color: colors.textSecondary }]}
            >
              {t?.profile?.noBadges || 'अभी कोई बैज अनलॉक नहीं हुआ। प्रैक्टिस जारी रखें!'}
            </Text>
          </View>
        ) : (
          <View style={styles.badgesGrid}>
            {activeUserBadges.map((badgeKey: string) => {
              const badge = ALL_AVAILABLE_BADGES[badgeKey];
              return (
                <View
                  key={badgeKey}
                  style={[
                    styles.badgeItemCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIconOuterCircle,
                      {
                        backgroundColor: isDarkMode
                          ? badge.bgDark
                          : badge.bgLight,
                      },
                    ]}
                  >
                    {badge.icon}
                  </View>
                  <Text
                    style={[
                      styles.badgeItemText,
                      { color: colors.textPrimary },
                    ]}
                    numberOfLines={2}
                  >
                    {badge.labelDefault}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Certificates Section */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.profile?.certificates || 'सर्टिफिकेट्स'}
        </Text>
        <View
          style={[
            styles.certificateRowCard,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.certIconBlueCircle,
              { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
            ]}
          >
            <Award size={24} color={colors.primary} />
          </View>
          <View style={styles.certDetails}>
            <Text style={[styles.certTitle, { color: colors.textPrimary }]}>
              {currentLang === 'hi' ? 'B2 कन्वर्सेशन फ्लूएंसी' : 'B2 Conversation Fluency'}
            </Text>
            <Text style={[styles.certSub, { color: colors.textSecondary }]}>
              {t?.profile?.issuedDate || 'जनवरी 2026 में जारी · वेरीफाइड'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.certDownloadBtn,
              { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
            ]}
          >
            <Download size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Subscription Control Layer */}
        {userData?.isPremium && (
          <TouchableOpacity
            style={[
              styles.subscriptionCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#0F172A' },
            ]}
            activeOpacity={0.95}
          >
            <View style={styles.subsIconOrangeCircle}>
              <Crown size={22} color="#F59E0B" />
            </View>
            <View style={styles.subsDetails}>
              <Text style={styles.subsTitle}>
                {currentLang === 'hi' ? 'सब्सक्रिप्शन मैनेज करें' : 'Manage subscription'}
              </Text>
              <Text style={styles.subsSub}>
                {currentLang === 'hi' ? 'प्रीमियम · एक्टिव' : 'Premium · Active'}
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* ─── DEDICATED SIGN OUT BUTTON BLOCK ─── */}
        <TouchableOpacity
          style={[
            styles.signOutCard,
            {
              backgroundColor: isDarkMode ? '#3f1c1c' : '#FEF2F2',
              borderColor: isDarkMode ? '#7f1d1d' : '#FCA5A5',
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={styles.signOutIconContainer}>
            <LogOut size={20} color="#DC2626" />
          </View>
          <Text style={styles.signOutCardText}>
            {t?.profile?.signOut || 'साइन आउट करें'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fixedTopBannerGradient: {
    paddingTop: STATUS_BAR_HEIGHT + 10,
    paddingBottom: 14,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  headerContentInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    width: '100%',
  },
  fixedHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  scrollContainer: {
    paddingTop: STATUS_BAR_HEIGHT + 75,
    paddingBottom: 140,
  },
  profileMetaWrapper: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  avatarWrapperContainer: {
    width: 114,
    height: 114,
    borderRadius: 57,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarMainImage: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  avatarMainCircle: {
    width: 102,
    height: 102,
    borderRadius: 51,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMainText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 14,
    borderWidth: 1,
  },
  premiumText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 5,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  profileSubText: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  statsCard: {
    borderRadius: 24,
    marginHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 26,
    elevation: 3,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  verticalDivider: { width: 1, height: 42 },
  statNumber: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    marginHorizontal: 20,
    marginBottom: 14,
    marginTop: 4,
  },
  progressCardBlock: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 6,
    marginHorizontal: 20,
    marginBottom: 28,
    elevation: 2,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  progressRow: { marginBottom: 18 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressMetricName: { fontSize: 15, fontWeight: '700' },
  progressMetricValue: { fontSize: 15, fontWeight: '800' },
  trackBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  filledTrack: { height: 8, borderRadius: 4 },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  badgeItemCard: {
    width: (SCREEN_WIDTH - 54) / 3,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 14,
    marginRight: 6,
    elevation: 2,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  badgeIconOuterCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeItemText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  emptyBadgesCard: {
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: 20,
  },
  emptyBadgesText: { fontSize: 14, fontWeight: '500' },
  certificateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    elevation: 2,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  certIconBlueCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  certDetails: { flex: 1 },
  certTitle: { fontSize: 15, fontWeight: '700' },
  certSub: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  certDownloadBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  subsIconOrangeCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  subsDetails: { flex: 1 },
  subsTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  subsSub: { fontSize: 13, color: '#94A3B8', marginTop: 3, fontWeight: '500' },
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  signOutIconContainer: {
    marginRight: 10,
  },
  signOutCardText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
});