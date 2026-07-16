import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, StatusBar, SafeAreaView } from 'react-native';
import { ChevronLeft, Flame, Mic, Trophy, Heart } from 'lucide-react-native';

const TODAY_NOTIFICATIONS = [
  {
    id: 't1',
    type: 'streak',
    title: 'Streak alert',
    desc: "You're on a 12-day streak! Speak today to keep it alive.",
    time: '2h',
    unread: true,
    icon: <Flame size={22} color="#F59E0B" />,
    bg: '#FFF7ED',
  },
  {
    id: 't2',
    type: 'room',
    title: 'Room starting soon',
    desc: "'IELTS Speaking Part 2' with Priya starts in 15 minutes.",
    time: '3h',
    unread: true,
    icon: <Mic size={22} color="#2563EB" />,
    bg: '#EFF6FF',
  },
];

const YESTERDAY_NOTIFICATIONS = [
  {
    id: 'y1',
    type: 'badge',
    title: 'New badge unlocked',
    desc: "You earned the 'Fearless Speaker' badge. Nicely done!",
    time: '1d',
    unread: false,
    icon: <Trophy size={22} color="#10B981" />,
    bg: '#E8F5E9',
  },
  {
    id: 'y2',
    type: 'like',
    title: 'Marco liked your post',
    desc: 'Your tip about daily recording is getting popular.',
    time: '1d',
    unread: false,
    icon: <Heart size={22} color="#EF4444" />,
    bg: '#FEF2F2',
  },
];

export default function NotificationScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={styles.mainContainer}>
        {/* ─── TOP PLAIN HEADER BAR ─── */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Notifications</Text>
          
          <TouchableOpacity style={styles.markReadBtn} activeOpacity={0.7}>
            <Text style={styles.checkIcon}>✓ </Text>
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {/* ─── NOTIFICATIONS LIST VIEW ─── */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          
          {/* TODAY GROUPING */}
          <Text style={styles.timeGroupHeading}>TODAY</Text>
          {TODAY_NOTIFICATIONS.map((item) => (
            <View key={item.id} style={styles.notificationCard}>
              <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                {item.icon}
              </View>
              
              <View style={styles.textDetailsBlock}>
                <View style={styles.titleMetaRow}>
                  <View style={styles.titleBadgeContainer}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    {item.unread && <View style={styles.unreadDotBlue} />}
                  </View>
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <Text style={styles.descriptionText}>{item.desc}</Text>
              </View>
            </View>
          ))}

          {/* YESTERDAY GROUPING */}
          <Text style={styles.timeGroupHeading}>YESTERDAY</Text>
          {YESTERDAY_NOTIFICATIONS.map((item) => (
            <View key={item.id} style={styles.notificationCard}>
              <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                {item.icon}
              </View>
              
              <View style={styles.textDetailsBlock}>
                <View style={styles.titleMetaRow}>
                  <View style={styles.titleBadgeContainer}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    {item.unread && <View style={styles.unreadDotBlue} />}
                  </View>
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <Text style={styles.descriptionText}>{item.desc}</Text>
              </View>
            </View>
          ))}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContainer: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // Android par StatusBar height calculate karke dynamic padding apply karega
    paddingTop: Platform.OS === 'ios' ? 12 : (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20),
    paddingBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginLeft: 16,
    letterSpacing: -0.4,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkIcon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563EB',
  },
  markReadText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },
  timeGroupHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 14,
    marginTop: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textDetailsBlock: {
    flex: 1,
    paddingTop: 2,
  },
  titleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  titleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  unreadDotBlue: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginLeft: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '500',
  },
});