import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Dimensions, Platform, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Settings, Award, ChevronRight, Download, Flame, Mic, Sparkles, Trophy, GraduationCap, Crown } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROGRESS_DATA = [
  { label: 'Pronunciation', value: '88%', color: '#10B981' },
  { label: 'Grammar', value: '76%', color: '#2563EB' },
  { label: 'Vocabulary', value: '81%', color: '#0D9488' },
  { label: 'Fluency', value: '68%', color: '#F59E0B' },
];

const BADGES_DATA = [
  { id: '1', label: '12-Day Streak', icon: <Flame size={24} color="#F59E0B" />, bg: '#FFF7ED' },
  { id: '2', label: '50 Rooms', icon: <Mic size={24} color="#2563EB" />, bg: '#EFF6FF' },
  { id: '3', label: 'AI Master', icon: <Sparkles size={24} color="#0D9488" />, bg: '#E6F4F1' },
  { id: '4', label: 'Top 10%', icon: <Trophy size={24} color="#10B981" />, bg: '#E8F5E9' },
  { id: '5', label: 'IELTS Ready', icon: <GraduationCap size={24} color="#6366F1" />, bg: '#EEF2FF' },
  { id: '6', label: 'Club Legend', icon: <Crown size={24} color="#F59E0B" />, bg: '#FFF7ED' },
];

export default function ProfileScreen({ navigation }: any) {
  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* ─── FIXED TOP GRADIENT HEADER BAR (HOME SCREEN JAISA STABLE BORDER) ─── */}
      <LinearGradient 
        colors={['#2563EB', '#0D9488']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.fixedTopBannerGradient}
      >
        <View style={styles.headerContentInline}>
          <Text style={styles.fixedHeaderTitle}>My Profile</Text>
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Settings size={22} color="#FFFFFF" opacity={0.9} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main Scroll Content Area */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        
        {/* Profile Info Block (Ab bilkul safe location pr render hoga, no overlapping cuts) */}
        <View style={styles.profileMetaWrapper}>
          
          {/* Avatar Ring Container */}
          <View style={styles.avatarWrapperContainer}>
            <View style={styles.avatarMainCircle}>
              <Text style={styles.avatarMainText}>RK</Text>
            </View>
          </View>

          {/* Premium Tag Indicator Badge */}
          <View style={styles.premiumBadge}>
            <Crown size={13} color="#D97706" />
            <Text style={styles.premiumText}>Premium</Text>
          </View>

          {/* User Details */}
          <Text style={styles.profileName}>Rahul Kumar</Text>
          <Text style={styles.profileSubText}>Level B2 · Upper Intermediate · Joined Mar 2024</Text>
        </View>

        {/* Overview Stats Card Grid */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <View style={styles.circleProgressRing}>
              <Text style={styles.circleProgressVal}>82</Text>
              <Text style={styles.circleProgressLbl}>Speaking</Text>
            </View>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>128</Text>
            <Text style={styles.statLabel}>Rooms joined</Text>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>12</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
        </View>

        {/* Core Metric Analytics Blocks */}
        <Text style={styles.sectionHeading}>Speaking Progress</Text>
        <View style={styles.progressCardBlock}>
          {PROGRESS_DATA.map((item, idx) => (
            <View key={idx} style={styles.progressRow}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressMetricName}>{item.label}</Text>
                <Text style={styles.progressMetricValue}>{item.value}</Text>
              </View>
              <View style={styles.trackBg}>
                <View style={[styles.filledTrack, { width: item.value, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Badges Matrix Block */}
        <Text style={styles.sectionHeading}>Achievements & Badges</Text>
        <View style={styles.badgesGrid}>
          {BADGES_DATA.map((badge) => (
            <View key={badge.id} style={styles.badgeItemCard}>
              <View style={[styles.badgeIconOuterCircle, { backgroundColor: badge.bg }]}>
                {badge.icon}
              </View>
              <Text style={styles.badgeItemText} numberOfLines={2}>{badge.label}</Text>
            </View>
          ))}
        </View>

        {/* Certificates Section */}
        <Text style={styles.sectionHeading}>Certificates</Text>
        <View style={styles.certificateRowCard}>
          <View style={styles.certIconBlueCircle}>
            <Award size={24} color="#2563EB" />
          </View>
          <View style={styles.certDetails}>
            <Text style={styles.certTitle}>B2 Conversation Fluency</Text>
            <Text style={styles.certSub}>Issued Jan 2026 · Verified</Text>
          </View>
          <TouchableOpacity style={styles.certDownloadBtn}>
            <Download size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Subscription Control Layer */}
        <TouchableOpacity style={styles.subscriptionCard} activeOpacity={0.95}>
          <View style={styles.subsIconOrangeCircle}>
            <Crown size={22} color="#F59E0B" />
          </View>
          <View style={styles.subsDetails}>
            <Text style={styles.subsTitle}>Manage subscription</Text>
            <Text style={styles.subsSub}>Premium · renews Feb 12</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  // Fixed header setup matching premium borders
  fixedTopBannerGradient: {
    height: Platform.OS === 'ios' ? 105 : 90,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
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
    position: 'relative',
    width: '100%',
  },
  fixedHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  scrollContainer: { 
    paddingTop: Platform.OS === 'ios' ? 130 : 115, // Smooth spacing dynamic check
    paddingBottom: 140 
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarMainCircle: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMainText: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  premiumText: { color: '#D97706', fontWeight: '700', fontSize: 12, marginLeft: 5 },
  profileName: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginTop: 12, letterSpacing: -0.3 },
  profileSubText: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', fontWeight: '500', lineHeight: 18 },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 26,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  verticalDivider: { width: 1, height: 42, backgroundColor: '#F1F5F9' },
  circleProgressRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#2563EB',
    borderTopColor: '#E2E8F0', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleProgressVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  circleProgressLbl: { fontSize: 8, color: '#64748B', fontWeight: '700', marginTop: -2, textTransform: 'uppercase', letterSpacing: 0.2 },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 3 },
  sectionHeading: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginHorizontal: 20, marginBottom: 14, marginTop: 4 },
  progressCardBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 6,
    marginHorizontal: 20,
    marginBottom: 28,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  progressRow: { marginBottom: 18 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressMetricName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  progressMetricValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  trackBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  filledTrack: { height: 8, borderRadius: 4 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  badgeItemCard: {
    width: (SCREEN_WIDTH - 54) / 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
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
  badgeItemText: { fontSize: 12, fontWeight: '700', color: '#1E293B', textAlign: 'center', lineHeight: 15 },
  certificateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  certIconBlueCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  certDetails: { flex: 1 },
  certTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  certSub: { fontSize: 13, color: '#64748B', marginTop: 3, fontWeight: '500' },
  certDownloadBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
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
});