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
  Easing
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const { width } = Dimensions.get('window');

// 🌐 NAME TRANSLITERATION HELPER (FOR HINDI MODE)
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

// 💤 FLOATING ZZZ ANIMATION COMPONENT FOR 0 STREAK
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
      <Text style={{ fontSize: 18 }}>😴</Text>
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

// 🔥 DYNAMIC STREAK EMOJI HELPER (STREAK INCREASE PAR AUTOMATIC CHANGE)
const getStreakEmoji = (streakCount: number = 0) => {
  if (streakCount <= 0) return '😴'; // Sone wali
  if (streakCount < 4) return '🔥';  // 1-3 Days: Fire
  if (streakCount < 7) return '⚡';  // 4-6 Days: Energy
  if (streakCount < 14) return '🚀'; // 7-13 Days: Rocket
  if (streakCount < 30) return '💥'; // 14-29 Days: Boom
  return '👑';                       // 30+ Days: Crown
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  
  // 🌐 Global Theme Context
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

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [greetingKey, setGreetingKey] = useState<'goodMorning' | 'goodAfternoon' | 'goodEvening'>('goodMorning');

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 4 && currentHour < 12) {
      setGreetingKey('goodMorning');
    } else if (currentHour >= 12 && currentHour < 16) {
      setGreetingKey('goodAfternoon');
    } else {
      setGreetingKey('goodEvening');
    }

    const currentUser = auth().currentUser;

    if (currentUser) {
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .onSnapshot(
          (documentSnapshot) => {
            if (documentSnapshot.exists()) {
              setUserData(documentSnapshot.data());
            } else {
              setUserData({
                fullName: currentUser.displayName || 'User',
                streak: 0,
                speakingScore: 0,
                fluency: 0,
              });
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore error:", error);
            setLoading(false);
          }
        );

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const rawFullDisplayName = userData?.fullName || auth().currentUser?.displayName || 'User';
  const rawFirstName = rawFullDisplayName.split(' ')[0];
  const userFirstNameInHindi = toHindiName(rawFirstName, currentLang);
  const avatarInitials = rawFirstName.charAt(0).toUpperCase();

  const greetingText = t?.home?.[greetingKey] || 
    (greetingKey === 'goodMorning' ? 'Good morning' : greetingKey === 'goodAfternoon' ? 'Good afternoon' : 'Good evening');

  const userStreak = userData?.streak ?? 0;
  const streakEmoji = getStreakEmoji(userStreak);

  // Dynamic Theme Styling
  const cardBg = isDarkMode ? '#131C2E' : '#FFFFFF';
  const activeGlowBorder = colors.primary + (isDarkMode ? '55' : '33');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={false}
      />
      
      <ScrollView style={[styles.container, { backgroundColor: colors.bgLight }]} showsVerticalScrollIndicator={false}>
        
        {/* 1. TOP HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            </View>
            <View style={styles.userTextContainer}>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]}>{greetingText}</Text>
              <Text style={[styles.userNameText, { color: colors.textPrimary }]}>{userFirstNameInHindi}</Text>
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

        {/* 2. STATS ROW */}
        <View style={styles.statsRow}>
          {/* 🔥 DYNAMIC STREAK CARD WITH FLOATING ZZZ */}
          <View style={[styles.streakCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]}>
            <View style={styles.streakHeader}>
              <View style={[styles.emojiBadge, { backgroundColor: colors.primary + '1F' }]}>
                {userStreak <= 0 ? (
                  <SleepingZzzAnimation />
                ) : (
                  <Text style={styles.streakEmoji}>{streakEmoji}</Text>
                )}
              </View>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
                {t?.home?.streak || 'Streak'}
              </Text>
            </View>
            <Text style={[styles.streakCountNumber, { color: colors.textPrimary }]}>{userStreak}</Text>
            <Text style={[styles.streakSubText, { color: colors.textSecondary }]}>
              {t?.home?.daysInRow || 'days in a row'}
            </Text>
            
            <View style={styles.dotsRow}>
              <View style={[styles.dot, userStreak >= 1 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 2 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 3 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 4 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 5 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 6 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              <View style={[styles.dot, userStreak >= 7 ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
            </View>
          </View>

          <View style={styles.ringsColumn}>
            {/* SPEAKING CARD */}
            <View style={[styles.ringMiniCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]}>
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

            {/* FLUENCY CARD */}
            <View style={[styles.ringMiniCard, { backgroundColor: cardBg, borderColor: 'rgba(16, 185, 129, 0.35)', shadowColor: '#10B981' }]}>
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
          <View style={[styles.liveHeroCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <View style={styles.liveCardHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveBadgeDot} />
                <Text style={styles.liveBadgeText}>
                  {t?.home?.liveNow || 'LIVE NOW'}
                </Text>
              </View>
              <Text style={styles.waveIcon}>📊</Text>
            </View>

            <Text style={styles.heroCardTitle}>
              {t?.home?.morningTalk || 'Morning Small Talk'}
            </Text>
            <Text style={styles.heroCardDesc}>
              {t?.home?.casualConv || 'Casual conversation to start your day'}
            </Text>

            <View style={styles.heroFooterRow}>
              <View style={styles.heroAvatarStack}>
                <View style={[styles.stackAvatar, { backgroundColor: '#3B82F6', marginLeft: 0 }]}><Text style={styles.stackAvatarText}>AK</Text></View>
                <View style={[styles.stackAvatar, { backgroundColor: '#F59E0B' }]}><Text style={styles.stackAvatarText}>YT</Text></View>
                <View style={[styles.stackAvatar, { backgroundColor: '#60A5FA' }]}><Text style={styles.stackAvatarText}>OF</Text></View>
                <View style={[styles.stackAvatar, { backgroundColor: '#A78BFA' }]}><Text style={styles.stackAvatarText}>DR</Text></View>
              </View>

              <TouchableOpacity style={styles.heroJoinButton} activeOpacity={0.88}>
                <Text style={[styles.heroJoinBtnText, { color: colors.primary }]}>
                  {t?.home?.joinRoom || 'Join room ›'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 4. TODAY'S CHALLENGE */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.home?.todayChallenge || "Today's Challenge"}
        </Text>
        <TouchableOpacity style={[styles.challengeCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]} activeOpacity={0.85}>
          <View style={[styles.challengeIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
            <Text style={styles.challengeIcon}>⚡</Text>
          </View>
          <View style={styles.challengeDetails}>
            <Text style={[styles.challengeMainTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {t?.home?.describeYour || 'Describe your ...'}
            </Text>
            <Text style={[styles.challengeSubTitle, { color: colors.textSecondary }]}>
              {t?.home?.speakingChallenge || '60-second speaking challenge'}
            </Text>
            <View style={styles.xpRow}>
              <View style={styles.xpBadge}>
                <Text style={styles.xpText}>+50 XP</Text>
              </View>
              <Text style={[styles.joinedCountText, { color: colors.textSecondary }]}>
                1,240 {t?.home?.joined || 'joined'}
              </Text>
            </View>
          </View>
          <Text style={[styles.rightArrowIcon, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>

        {/* 5. UPCOMING SESSIONS */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>
            {t?.home?.upcomingSessions || 'Upcoming Sessions'}
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              {t?.home?.seeAll || 'See all'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollWrapper}>
          <View style={[styles.upcomingSessionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]}>
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

          <View style={[styles.upcomingSessionCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]}>
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

        {/* 6. FROM THE COMMUNITY */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>
            {t?.home?.fromCommunity || 'From the Community'}
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              {t?.home?.seeAll || 'See all'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.communityPostCard, { backgroundColor: cardBg, borderColor: activeGlowBorder, shadowColor: colors.primary }]}>
          <View style={styles.postUserRow}>
            <View style={[styles.postUserAvatar, { backgroundColor: colors.primary }]}><Text style={styles.postAvatarText}>DR</Text></View>
            <View style={styles.postUserInfo}>
              <Text style={[styles.postUserName, { color: colors.textPrimary }]}>
                {toHindiName(t?.home?.postAuthor || 'Diego Ramos', currentLang)}
              </Text>
              <Text style={[styles.postTimeText, { color: colors.textSecondary }]}>
                {t?.home?.postTime || '2h ago'}
              </Text>
            </View>
            <View style={styles.ieltsBadge}>
              <Text style={styles.ieltsBadgeText}>🏆 IELTS 7.5</Text>
            </View>
          </View>
          <Text style={[styles.postContentText, { color: colors.textPrimary }]}>
            {t?.home?.postContent || 'Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.'}
          </Text>
          <View style={styles.postStatsRow}>
            <Text style={[styles.postStatItem, { color: colors.textSecondary }]}>
              👍 511 {t?.home?.likes || 'likes'}
            </Text>
            <Text style={[styles.postStatItem, { color: colors.textSecondary }]}>
              💬 88 {t?.home?.comments || 'comments'}
            </Text>
          </View>
        </View>

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

          <View style={[styles.activityItemRow, { backgroundColor: cardBg, borderColor: activeGlowBorder }]}>
            <View style={[styles.activityIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}><Text style={styles.actIcon}>✨</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={[styles.activityTitleText, { color: colors.textPrimary }]}>
                {t?.home?.act2Title || 'Completed AI session'}
              </Text>
              <Text style={[styles.activityTimeTextOffset, { color: colors.textSecondary }]}>
                {t?.home?.act2Time || 'Yesterday'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 15, paddingBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  userTextContainer: { marginLeft: 12 },
  greetingText: { fontSize: 13, fontWeight: '600' },
  userNameText: { fontSize: 21, fontWeight: '800', marginTop: 1 },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  bellIcon: { fontSize: 18 },
  redDotBadge: { position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', marginTop: 10 },
  streakCard: { borderRadius: 26, padding: 16, width: (width - 55) * 0.5, borderWidth: 1.5, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  streakHeader: { flexDirection: 'row', alignItems: 'center' },
  emojiBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  streakEmoji: { fontSize: 16 },
  streakLabel: { fontSize: 14, fontWeight: '700' },
  streakCountNumber: { fontSize: 36, fontWeight: '800', marginTop: 10 },
  streakSubText: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  ringsColumn: { width: (width - 55) * 0.5, justifyContent: 'space-between' },
  ringMiniCard: { borderRadius: 24, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', height: 72, borderWidth: 1.5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  scoreBadgeCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  scoreValueText: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  ringInfoTextContainer: { flex: 1 },
  ringTitle: { fontSize: 14, fontWeight: '800' },
  ringSubtitle: { fontSize: 11, marginTop: 2, fontWeight: '600' },

  heroCardContainer: { marginHorizontal: 20, marginTop: 24 },
  liveHeroCard: { borderRadius: 28, padding: 22, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  liveBadgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFFFFF', marginRight: 6 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  waveIcon: { fontSize: 16, color: '#FFFFFF' },
  heroCardTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 18 },
  heroCardDesc: { fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', marginTop: 6, lineHeight: 20, fontWeight: '500' },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  heroAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 34, height: 34, borderRadius: 17, marginLeft: -10, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  stackAvatarText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  heroJoinButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  heroJoinBtnText: { fontWeight: '800', fontSize: 13 },

  sectionHeading: { fontSize: 19, fontWeight: '800', marginLeft: 20, marginTop: 28, letterSpacing: -0.2 },
  challengeCard: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, padding: 18, borderRadius: 26, alignItems: 'center', borderWidth: 1.5, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  challengeIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  challengeIcon: { fontSize: 22 },
  challengeDetails: { flex: 1 },
  challengeMainTitle: { fontSize: 16, fontWeight: '800' },
  challengeSubTitle: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  xpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  xpBadge: { backgroundColor: 'rgba(245, 158, 11, 0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  xpText: { color: '#D97706', fontSize: 11, fontWeight: '800' },
  joinedCountText: { fontSize: 12, fontWeight: '600' },
  rightArrowIcon: { fontSize: 24, fontWeight: '800' },

  sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 28 },
  sectionHeadingMarginless: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  seeAllText: { fontSize: 14, fontWeight: '700' },
  horizontalScrollWrapper: { paddingLeft: 20, marginTop: 14 },
  upcomingSessionCard: { width: width * 0.68, marginRight: 16, padding: 18, borderRadius: 26, borderWidth: 1.5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  sessionHeaderPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sessionTimeText: { fontSize: 12, fontWeight: '800' },
  sessionMainTitle: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  sessionDescText: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  sessionFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  sessionInitialsCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  initialsText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  sessionDurationText: { fontSize: 12, fontWeight: '600' },

  communityPostCard: { marginHorizontal: 20, marginTop: 14, padding: 18, borderRadius: 26, borderWidth: 1.5, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  postUserRow: { flexDirection: 'row', alignItems: 'center' },
  postUserAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  postAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  postUserInfo: { flex: 1 },
  postUserName: { fontSize: 15, fontWeight: '800' },
  postTimeText: { fontSize: 12, marginTop: 1, fontWeight: '500' },
  ieltsBadge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  ieltsBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  postContentText: { fontSize: 14, marginTop: 14, lineHeight: 21, fontWeight: '500' },
  postStatsRow: { flexDirection: 'row', marginTop: 16 },
  postStatItem: { fontSize: 13, marginRight: 18, fontWeight: '700' },

  recentActivityContainer: { paddingHorizontal: 20, marginTop: 8 },
  activityItemRow: { flexDirection: 'row', padding: 16, borderRadius: 24, alignItems: 'center', marginTop: 10, borderWidth: 1.5 },
  activityIconWrapper: { width: 42, height: 42, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  actIcon: { fontSize: 18 },
  activityMainDetails: { flex: 1 },
  activityTitleText: { fontSize: 15, fontWeight: '800' },
  activityTimeTextOffset: { fontSize: 12, marginTop: 2, fontWeight: '500' }
});