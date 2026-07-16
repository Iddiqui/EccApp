import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  StatusBar,
  SafeAreaView,
  Platform
} from 'react-native';
// useNavigation hook ko import kiya
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  // Navigation stack actions active karne ke liye hook initialized kiya
  const navigation = useNavigation<any>();

  return (
    // SafeAreaView content ko notch aur status bar se niche rakhta hai
    <SafeAreaView style={styles.safeArea}>
      {/* Status Bar text aur icons ko properly visible aur dark rakhne ke liye */}
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#F8FAFC" 
        translucent={false}
      />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* 1. TOP AVATAR & HEADER ROW */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>RK</Text>
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.greetingText}>Good morning</Text>
              <Text style={styles.userNameText}>Rahul</Text>
            </View>
          </View>
          
          {/* ─── NOTIFICATION BELL ICON ONPRESS HANDLER ADDED ─── */}
          <TouchableOpacity 
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.redDotBadge} />
          </TouchableOpacity>
        </View>

        {/* 2. DASHBOARD STATS SECTION (STREAK & RINGS) */}
        <View style={styles.statsRow}>
          {/* Streak Card */}
          <View style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakLabel}>Streak</Text>
            </View>
            <Text style={styles.streakCountNumber}>12</Text>
            <Text style={styles.streakSubText}>days in a row</Text>
            
            {/* Day Indicators */}
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          {/* Right Rings Container */}
          <View style={styles.ringsColumn}>
            {/* Speaking Ring Card */}
            <View style={styles.ringMiniCard}>
              <View style={[styles.ringTrack, { borderColor: '#2563EB' }]}>
                <Text style={styles.ringValueText}>82</Text>
              </View>
              <View style={styles.ringInfoTextContainer}>
                <Text style={styles.ringTitle}>Speaking</Text>
                <Text style={styles.ringSubtitle}>+4 this week</Text>
              </View>
            </View>

            {/* Fluency Ring Card */}
            <View style={styles.ringMiniCard}>
              <View style={[styles.ringTrack, { borderColor: '#059669' }]}>
                <Text style={styles.ringValueText}>68</Text>
              </View>
              <View style={styles.ringInfoTextContainer}>
                <Text style={styles.ringTitle}>Fluency</Text>
                <Text style={styles.ringSubtitle}>Level B2</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. HERO LIVE ROOM CARD */}
        <View style={styles.liveHeroCard}>
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
            {/* Stacked User Avatars */}
            <View style={styles.heroAvatarStack}>
              <View style={[styles.stackAvatar, { backgroundColor: '#3B82F6', marginLeft: 0 }]}><Text style={styles.stackAvatarText}>AK</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#F59E0B' }]}><Text style={styles.stackAvatarText}>YT</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#60A5FA' }]}><Text style={styles.stackAvatarText}>OF</Text></View>
              <View style={[styles.stackAvatar, { backgroundColor: '#A78BFA' }]}><Text style={styles.stackAvatarText}>DR</Text></View>
            </View>

            <TouchableOpacity style={styles.heroJoinButton}>
              <Text style={styles.heroJoinBtnText}>Join room  ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. TODAY'S CHALLENGE */}
        <Text style={styles.sectionHeading}>Today's Challenge</Text>
        <View style={styles.challengeCard}>
          <View style={styles.challengeIconCircle}>
            <Text style={styles.challengeIcon}>⚡</Text>
          </View>
          <View style={styles.challengeDetails}>
            <Text style={styles.challengeMainTitle} numberOfLines={1}>Describe your ...</Text>
            <Text style={styles.challengeSubTitle}>60-second speaking challenge</Text>
            <View style={styles.xpRow}>
              <View style={styles.xpBadge}><Text style={styles.xpText}>+50 XP</Text></View>
              <Text style={styles.joinedCountText}>1,240 joined</Text>
            </View>
          </View>
          <Text style={styles.rightArrowIcon}>›</Text>
        </View>

        {/* 5. UPCOMING SESSIONS (HORIZONTAL) */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeadingMarginless}>Upcoming Sessions</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>See all</Text></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollWrapper}>
          {/* Session Card 1 */}
          <View style={styles.upcomingSessionCard}>
            <Text style={styles.sessionTimeText}>📅 Today, 6:00 PM</Text>
            <Text style={styles.sessionMainTitle}>1:1 with Priya</Text>
            <Text style={styles.sessionDescText}>IELTS Speaking coaching</Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: '#22C55E' }]}><Text style={styles.initialsText}>PN</Text></View>
              <Text style={styles.sessionDurationText}>30 min • Video</Text>
            </View>
          </View>

          {/* Session Card 2 */}
          <View style={styles.upcomingSessionCard}>
            <Text style={styles.sessionTimeText}>🎙️ Today, 7:30 PM</Text>
            <Text style={styles.sessionMainTitle}>Debate Club</Text>
            <Text style={styles.sessionDescText}>Technology & Society</Text>
            <View style={styles.sessionFooterRow}>
              <View style={[styles.sessionInitialsCircle, { backgroundColor: '#6366F1' }]}><Text style={styles.initialsText}>DR</Text></View>
              <Text style={styles.sessionDurationText}>45 min • Audio</Text>
            </View>
          </View>
        </ScrollView>

        {/* 6. FROM THE COMMUNITY */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeadingMarginless}>From the Community</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>See all</Text></TouchableOpacity>
        </View>

        <View style={styles.communityPostCard}>
          <View style={styles.postUserRow}>
            <View style={[styles.postUserAvatar, { backgroundColor: '#6366F1' }]}><Text style={styles.postAvatarText}>DR</Text></View>
            <View style={styles.postUserInfo}>
              <Text style={styles.postUserName}>Diego Ramos</Text>
              <Text style={styles.postTimeText}>2h ago</Text>
            </View>
            <View style={styles.ieltsBadge}>
              <Text style={styles.ieltsBadgeText}>🏆 IELTS 7.5</Text>
            </View>
          </View>
          <Text style={styles.postContentText}>
            Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.
          </Text>
          <View style={styles.postStatsRow}>
            <Text style={styles.postStatItem}>511 likes</Text>
            <Text style={styles.postStatItem}>88 comments</Text>
          </View>
        </View>

        {/* 7. RECENT ACTIVITY LIST */}
        <Text style={styles.sectionHeading}>Recent Activity</Text>
        <View style={styles.recentActivityContainer}>
          <View style={styles.activityItemRow}>
            <View style={styles.activityIconWrapper}><Text style={styles.actIcon}>🎙️</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={styles.activityTitleText}>Joined 'Morning Small Talk'</Text>
              <Text style={styles.activityTimeTextOffset}>2h ago</Text>
            </View>
          </View>

          <View style={styles.activityItemRow}>
            <View style={styles.activityIconWrapper}><Text style={styles.actIcon}>✨</Text></View>
            <View style={styles.activityMainDetails}>
              <Text style={styles.activityTitleText}>Completed AI session</Text>
              <Text style={styles.activityTimeTextOffset}>Yesterday</Text>
            </View>
          </View>
        </View>

        {/* Bottom space */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 15, paddingBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  userTextContainer: { marginLeft: 12 },
  greetingText: { fontSize: 13, color: '#64748B' },
  userNameText: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  notificationBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bellIcon: { fontSize: 18 },
  redDotBadge: { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', marginTop: 10 },
  streakCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, width: (width - 55) * 0.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  streakHeader: { flexDirection: 'row', alignItems: 'center' },
  streakEmoji: { fontSize: 16, marginRight: 6 },
  streakLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  streakCountNumber: { fontSize: 34, fontWeight: '800', color: '#0F172A', marginTop: 12 },
  streakSubText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  dotsRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' },
  activeDot: { backgroundColor: '#F59E0B' },

  ringsColumn: { width: (width - 55) * 0.5, justifyContent: 'space-between' },
  ringMiniCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', height: 68, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 0.8 },
  ringTrack: { width: 42, height: 42, borderRadius: 21, borderWidth: 4, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  ringValueText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  ringInfoTextContainer: { flex: 1 },
  ringTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  ringSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },

  liveHeroCard: { backgroundColor: '#3B82F6', marginHorizontal: 20, marginTop: 24, borderRadius: 28, padding: 24, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 4 },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 6 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  waveIcon: { fontSize: 16, color: '#FFFFFF' },
  heroCardTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 20 },
  heroCardDesc: { fontSize: 14, color: '#E0E7FF', marginTop: 6, lineHeight: 20 },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  heroAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 32, height: 32, borderRadius: 16, marginLeft: -10, borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  stackAvatarText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  heroJoinButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  heroJoinBtnText: { color: '#3B82F6', fontWeight: '700', fontSize: 13 },

  sectionHeading: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginLeft: 20, marginTop: 28 },
  challengeCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  challengeIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  challengeIcon: { fontSize: 20, color: '#10B981' },
  challengeDetails: { flex: 1 },
  challengeMainTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  challengeSubTitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  xpBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8 },
  xpText: { color: '#D97706', fontSize: 11, fontWeight: '700' },
  joinedCountText: { fontSize: 12, color: '#64748B' },
  rightArrowIcon: { fontSize: 22, color: '#94A3B8', fontWeight: '600' },

  sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 28 },
  sectionHeadingMarginless: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  seeAllText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  horizontalScrollWrapper: { paddingLeft: 20, marginTop: 14 },
  upcomingSessionCard: { backgroundColor: '#FFFFFF', width: width * 0.65, marginRight: 16, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  sessionTimeText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  sessionMainTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 8 },
  sessionDescText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  sessionFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  sessionInitialsCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  initialsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  sessionDurationText: { fontSize: 12, color: '#64748B' },

  communityPostCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  postUserRow: { flexDirection: 'row', alignItems: 'center' },
  postUserAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  postUserInfo: { flex: 1 },
  postUserName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  postTimeText: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  ieltsBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ieltsBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  postContentText: { fontSize: 14, color: '#334155', marginTop: 14, lineHeight: 20 },
  postStatsRow: { flexDirection: 'row', marginTop: 14 },
  postStatItem: { fontSize: 13, color: '#64748B', marginRight: 16, fontWeight: '500' },

  recentActivityContainer: { paddingHorizontal: 20, marginTop: 8 },
  activityItemRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  activityIconWrapper: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actIcon: { fontSize: 16 },
  activityMainDetails: { flex: 1 },
  activityTitleText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  activityTimeTextOffset: { fontSize: 11, color: '#94A3B8', marginTop: 2 }
});