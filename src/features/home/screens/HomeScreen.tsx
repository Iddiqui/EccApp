import React, { useEffect, useState } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDarkMode } = useTheme();
  const colors = theme.colors;
  
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    // ─── TIME-BASED GREETING LOGIC ───
    const currentHour = new Date().getHours();
    if (currentHour >= 4 && currentHour < 12) {
      setGreeting('Good morning');
    } else if (currentHour >= 12 && currentHour < 16) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }

    const currentUser = auth().currentUser;

    if (currentUser) {
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .onSnapshot(
          (documentSnapshot) => {
            if (documentSnapshot.exists) {
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
            console.error("Firestore real-time sync mapping error:", error);
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

  const fullDisplayName = userData?.fullName || 'Google User';
  const firstName = fullDisplayName.split(' ')[0];
  const avatarInitials = firstName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={false}
      />
      
      <ScrollView style={[styles.container, { backgroundColor: colors.bgLight }]} showsVerticalScrollIndicator={false}>
        
        {/* 1. TOP AVATAR & HEADER ROW */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            </View>
            <View style={styles.userTextContainer}>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]}>{greeting}</Text>
              <Text style={[styles.userNameText, { color: colors.textPrimary }]}>{firstName}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.notificationBtn, { backgroundColor: colors.bgCard }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={[styles.redDotBadge, { backgroundColor: colors.alertRed }]} />
          </TouchableOpacity>
        </View>

        {/* 2. DASHBOARD STATS SECTION (STREAK & SCORES WITHOUT CIRCLES) */}
        <View style={styles.statsRow}>
          <View style={[styles.streakCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.streakHeader}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Streak</Text>
            </View>
            <Text style={[styles.streakCountNumber, { color: colors.textPrimary }]}>{userData?.streak ?? 0}</Text>
            <Text style={[styles.streakSubText, { color: colors.textSecondary }]}>days in a row</Text>
            
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
            </View>
          </View>

          <View style={styles.ringsColumn}>
            {/* SPEAKING CARD (CIRCLE REMOVED) */}
            <View style={[styles.ringMiniCard, { backgroundColor: colors.bgCard }]}>
              <Text style={[styles.scoreValueText, { color: colors.primary }]}>
                {userData?.speakingScore ?? 0}
              </Text>
              <View style={styles.ringInfoTextContainer}>
                <Text style={[styles.ringTitle, { color: colors.textPrimary }]}>Speaking</Text>
                <Text style={[styles.ringSubtitle, { color: colors.textSecondary }]}>+4 this week</Text>
              </View>
            </View>

            {/* FLUENCY CARD (CIRCLE REMOVED) */}
            <View style={[styles.ringMiniCard, { backgroundColor: colors.bgCard }]}>
              <Text style={[styles.scoreValueText, { color: colors.successGreen }]}>
                {userData?.fluency ?? 0}
              </Text>
              <View style={styles.ringInfoTextContainer}>
                <Text style={[styles.ringTitle, { color: colors.textPrimary }]}>Fluency</Text>
                <Text style={[styles.ringSubtitle, { color: colors.textSecondary }]}>Level B2</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. HERO LIVE ROOM CARD */}
        <View style={[styles.liveHeroCard, { backgroundColor: colors.primary }]}>
          <View style={styles.liveCardHeader}>
            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeText}>LIVE NOW</Text>
            </View>
            <Text style={styles.waveIcon}>📊</Text>
          </View>

          <Text style={styles.heroCardTitle}>Morning Small Talk</Text>
          <Text style={styles.heroCardDesc}>Casual conversation to start your day</Text>

          <View style={styles.heroFooterRow}>
            <View style={styles.heroAvatarStack}>
              <View style={[styles.stackAvatar, { backgroundColor: '#3B82F6', marginLeft: 0, borderColor: colors.primary }]}><Text style={styles.stackAvatarText}>AK</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#F59E0B', borderColor: colors.primary }]}><Text style={styles.stackAvatarText}>YT</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#60A5FA', borderColor: colors.primary }]}><Text style={styles.stackAvatarText}>OF</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#A78BFA', borderColor: colors.primary }]}><Text style={styles.stackAvatarText}>DR</Text></View>
            </View>

            <TouchableOpacity style={styles.heroJoinButton}>
              <Text style={[styles.heroJoinBtnText, { color: colors.primary }]}>Join room ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. TODAY'S CHALLENGE */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Today's Challenge</Text>
        <View style={[styles.challengeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.challengeIconCircle}>
            <Text style={styles.challengeIcon}>⚡</Text>
          </View>
          <View style={styles.challengeDetails}>
            <Text style={[styles.challengeMainTitle, { color: colors.textPrimary }]} numberOfLines={1}>Describe your ...</Text>
            <Text style={[styles.challengeSubTitle, { color: colors.textSecondary }]}>60-second speaking challenge</Text>
            <View style={styles.xpRow}>
              <View style={styles.xpBadge}><Text style={styles.xpText}>+50 XP</Text></View>
              <Text style={[styles.joinedCountText, { color: colors.textSecondary }]}>1,240 joined</Text>
            </View>
          </View>
          <Text style={[styles.rightArrowIcon, { color: colors.textSecondary }]}>›</Text>
        </View>

        {/* 5. UPCOMING SESSIONS */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>Upcoming Sessions</Text>
          <TouchableOpacity><Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollWrapper}>
          <View style={[styles.upcomingSessionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sessionTimeText, { color: colors.primary }]}>📅 Today, 6:00 PM</Text>
            <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>1:1 with Priya</Text>
            <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>IELTS Speaking coaching</Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: '#22C55E' }]}><Text style={styles.initialsText}>PN</Text></View>
              <Text style={[styles.sessionDurationText, { color: colors.textSecondary }]}>30 min • Video</Text>
            </View>
          </View>

          <View style={[styles.upcomingSessionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sessionTimeText, { color: colors.primary }]}>🎙️ Today, 7:30 PM</Text>
            <Text style={[styles.sessionMainTitle, { color: colors.textPrimary }]}>Debate Club</Text>
            <Text style={[styles.sessionDescText, { color: colors.textSecondary }]}>Technology & Society</Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: '#6366F1' }]}><Text style={styles.initialsText}>DR</Text></View>
              <Text style={[styles.sessionDurationText, { color: colors.textSecondary }]}>45 min • Audio</Text>
            </View>
          </View>
        </ScrollView>

        {/* 6. FROM THE COMMUNITY */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeadingMarginless, { color: colors.textPrimary }]}>From the Community</Text>
          <TouchableOpacity><Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text></TouchableOpacity>
        </View>

        <View style={[styles.communityPostCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.postUserRow}>
            <View style={[styles.postUserAvatar, { backgroundColor: '#6366F1' }]}><Text style={styles.postAvatarText}>DR</Text></View>
            <View style={styles.postUserInfo}>
              <Text style={[styles.postUserName, { color: colors.textPrimary }]}>Diego Ramos</Text>
              <Text style={[styles.postTimeText, { color: colors.textSecondary }]}>2h ago</Text>
            </View>
            <View style={styles.ieltsBadge}>
              <Text style={styles.ieltsBadgeText}>🏆 IELTS 7.5</Text>
            </View>
          </View>
          <Text style={[styles.postContentText, { color: colors.textPrimary }]}>
            Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.
          </Text>
          <View style={styles.postStatsRow}>
            <Text style={[styles.postStatItem, { color: colors.textSecondary }]}>511 likes</Text>
            <Text style={[styles.postStatItem, { color: colors.textSecondary }]}>88 comments</Text>
          </View>
        </View>

        {/* 7. RECENT ACTIVITY LIST */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Recent Activity</Text>
        <View style={styles.recentActivityContainer}>
          <View style={[styles.activityItemRow, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.activityIconWrapper, { backgroundColor: colors.iconBg }]}><Text style={styles.actIcon}>🎙️</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={[styles.activityTitleText, { color: colors.textPrimary }]}>Joined 'Morning Small Talk'</Text>
              <Text style={[styles.activityTimeTextOffset, { color: colors.textSecondary }]}>2h ago</Text>
            </View>
          </View>

          <View style={[styles.activityItemRow, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.activityIconWrapper, { backgroundColor: colors.iconBg }]}><Text style={styles.actIcon}>✨</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={[styles.activityTitleText, { color: colors.textPrimary }]}>Completed AI session</Text>
              <Text style={[styles.activityTimeTextOffset, { color: colors.textSecondary }]}>Yesterday</Text>
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
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  userTextContainer: { marginLeft: 12 },
  greetingText: { fontSize: 13 },
  userNameText: { fontSize: 20, fontWeight: '800', marginTop: 1 },
  notificationBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bellIcon: { fontSize: 18 },
  redDotBadge: { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 3.5 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', marginTop: 10 },
  streakCard: { borderRadius: 24, padding: 16, width: (width - 55) * 0.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  streakHeader: { flexDirection: 'row', alignItems: 'center' },
  streakEmoji: { fontSize: 16, marginRight: 6 },
  streakLabel: { fontSize: 14, fontWeight: '600' },
  streakCountNumber: { fontSize: 34, fontWeight: '800', marginTop: 12 },
  streakSubText: { fontSize: 12, marginTop: 2 },
  dotsRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeDot: { backgroundColor: '#F59E0B' },

  ringsColumn: { width: (width - 55) * 0.5, justifyContent: 'space-between' },
  ringMiniCard: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', height: 68, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 0.8 },
  scoreValueText: { fontSize: 28, fontWeight: '800', marginRight: 14, minWidth: 20, textAlign: 'center' },
  ringInfoTextContainer: { flex: 1 },
  ringTitle: { fontSize: 14, fontWeight: '700' },
  ringSubtitle: { fontSize: 11, marginTop: 1 },

  liveHeroCard: { marginHorizontal: 20, marginTop: 24, borderRadius: 28, padding: 24, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 4 },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 6 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  waveIcon: { fontSize: 16, color: '#FFFFFF' },
  heroCardTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 20 },
  heroCardDesc: { fontSize: 14, color: '#E0E7FF', marginTop: 6, lineHeight: 20 },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  heroAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 32, height: 32, borderRadius: 16, marginLeft: -10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stackAvatarText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  heroJoinButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  heroJoinBtnText: { fontWeight: '700', fontSize: 13 },

  sectionHeading: { fontSize: 18, fontWeight: '800', marginLeft: 20, marginTop: 28 },
  challengeCard: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 24, alignItems: 'center', borderWidth: 1 },
  challengeIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  challengeIcon: { fontSize: 20, color: '#10B981' },
  challengeDetails: { flex: 1 },
  challengeMainTitle: { fontSize: 16, fontWeight: '700' },
  challengeSubTitle: { fontSize: 12, marginTop: 2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  xpBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8 },
  xpText: { color: '#D97706', fontSize: 11, fontWeight: '700' },
  joinedCountText: { fontSize: 12 },
  rightArrowIcon: { fontSize: 22, fontWeight: '600' },

  sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 28 },
  sectionHeadingMarginless: { fontSize: 18, fontWeight: '800' },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  horizontalScrollWrapper: { paddingLeft: 20, marginTop: 14 },
  upcomingSessionCard: { width: width * 0.65, marginRight: 16, padding: 16, borderRadius: 24, borderWidth: 1 },
  sessionTimeText: { fontSize: 13, fontWeight: '600' },
  sessionMainTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  sessionDescText: { fontSize: 13, marginTop: 2 },
  sessionFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  sessionInitialsCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  initialsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  sessionDurationText: { fontSize: 12 },

  communityPostCard: { marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 24, borderWidth: 1 },
  postUserRow: { flexDirection: 'row', alignItems: 'center' },
  postUserAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  postUserInfo: { flex: 1 },
  postUserName: { fontSize: 15, fontWeight: '700' },
  postTimeText: { fontSize: 12, marginTop: 1 },
  ieltsBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ieltsBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  postContentText: { fontSize: 14, marginTop: 14, lineHeight: 20 },
  postStatsRow: { flexDirection: 'row', marginTop: 14 },
  postStatItem: { fontSize: 13, marginRight: 16, fontWeight: '500' },

  recentActivityContainer: { paddingHorizontal: 20, marginTop: 8 },
  activityItemRow: { flexDirection: 'row', padding: 14, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  activityIconWrapper: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actIcon: { fontSize: 16 },
  activityMainDetails: { flex: 1 },
  activityTitleText: { fontSize: 14, fontWeight: '600' },
  activityTimeTextOffset: { fontSize: 11, marginTop: 2 }
});