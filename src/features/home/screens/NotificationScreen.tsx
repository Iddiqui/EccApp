import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  StatusBar, 
  SafeAreaView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { ChevronLeft, Flame, Mic, Trophy, Heart, BellOff } from 'lucide-react-native';

// EXPO-NOTIFICATIONS KI JAGAH FIREBASE IMPORT KAREIN
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

import { useTheme } from '../../../hooks/useTheme';

export interface AppNotification {
  id: string;
  type: 'streak' | 'room' | 'badge' | 'like';
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  targetRoomId?: string;
  targetBadgeId?: string;
}

export default function NotificationScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const themeHook = useTheme();
  const isDarkMode = themeHook?.isDarkMode || false;

  const colors = themeHook?.theme?.colors || themeHook?.colors || {
    bgLight: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#2563EB',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
  };

  // Fetch Notifications from Backend API
  const fetchNotifications = async () => {
    try {
      // REPLACE WITH YOUR BACKEND API
      setTimeout(() => {
        const fetchedData: AppNotification[] = [
          {
            id: '1',
            type: 'streak',
            title: 'Streak alert',
            desc: "You're on a 12-day streak! Speak today to keep it alive.",
            time: '2h ago',
            unread: true,
          },
          {
            id: '2',
            type: 'room',
            title: 'Room starting soon',
            desc: "'IELTS Speaking Part 2' with Priya starts in 15 minutes.",
            time: '3h ago',
            unread: true,
            targetRoomId: 'room_123'
          },
        ];
        setNotifications(fetchedData);
        setLoading(false);
        setRefreshing(false);
      }, 600);
    } catch (error) {
      console.error("Fetch error:", error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // 1. FOREGROUND PUSH LISTENER (React Native CLI / Firebase)
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const newNotif: AppNotification = {
        id: remoteMessage.messageId || String(Date.now()),
        type: (remoteMessage.data?.type as any) || 'room',
        title: remoteMessage.notification?.title || 'New Update',
        desc: remoteMessage.notification?.body || '',
        time: 'Just now',
        unread: true,
        targetRoomId: remoteMessage.data?.targetRoomId as string,
      };

      // Real-time screen state updates
      setNotifications(prev => [newNotif, ...prev]);

      // Screen ke upar local popup banner display karne ke liye (Notifee)
      await notifee.displayNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        android: {
          channelId: 'default',
        },
      });
    });

    return unsubscribe;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(item => ({ ...item, unread: false })));
  };

  const handleNotificationPress = (item: AppNotification) => {
    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, unread: false } : n))
    );

    if (item.type === 'room' && item.targetRoomId) {
      navigation.navigate('VoiceRoomScreen', { roomId: item.targetRoomId });
    } else if (item.type === 'badge') {
      navigation.navigate('ProfileScreen', { badgeId: item.targetBadgeId });
    }
  };

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'streak':
        return { icon: <Flame size={22} color="#F59E0B" />, bg: isDarkMode ? '#451A03' : '#FFF7ED' };
      case 'room':
        return { icon: <Mic size={22} color="#2563EB" />, bg: isDarkMode ? '#1E3A8A' : '#EFF6FF' };
      case 'badge':
        return { icon: <Trophy size={22} color="#10B981" />, bg: isDarkMode ? '#064E3B' : '#E8F5E9' };
      case 'like':
        return { icon: <Heart size={22} color="#EF4444" />, bg: isDarkMode ? '#7F1D1D' : '#FEF2F2' };
      default:
        return { icon: <Mic size={22} color="#2563EB" />, bg: isDarkMode ? '#1E3A8A' : '#EFF6FF' };
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.bgLight} 
      />
      
      <View style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
        <View style={[styles.headerContainer, { backgroundColor: colors.bgLight }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
          
          <TouchableOpacity style={styles.markReadBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={[styles.checkIcon, { color: colors.primary }]}>✓ </Text>
            <Text style={[styles.markReadText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerContainer}>
            <BellOff size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No notifications yet</Text>
            <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
              We'll notify you when rooms start, badges unlock, or updates happen.
            </Text>
          </View>
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
          >
            {notifications.map((item) => {
              const { icon, bg } = renderIcon(item.type);
              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[
                    styles.notificationCard, 
                    { 
                      backgroundColor: colors.bgCard, 
                      borderColor: item.unread ? colors.primary : colors.border,
                      borderWidth: item.unread ? 1.5 : 1
                    }
                  ]}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                    {icon}
                  </View>
                  
                  <View style={styles.textDetailsBlock}>
                    <View style={styles.titleMetaRow}>
                      <View style={styles.titleBadgeContainer}>
                        <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                        {item.unread && <View style={[styles.unreadDotBlue, { backgroundColor: colors.primary }]} />}
                      </View>
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>{item.time}</Text>
                    </View>
                    <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{item.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainContainer: { flex: 1 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20),
    paddingBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    marginLeft: 16,
    letterSpacing: -0.4,
  },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkIcon: { fontSize: 15, fontWeight: '800' },
  markReadText: { fontSize: 14, fontWeight: '700' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textDetailsBlock: { flex: 1, paddingTop: 2 },
  titleMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  titleBadgeContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  notifTitle: { fontSize: 15, fontWeight: '700' },
  unreadDotBlue: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  timeText: { fontSize: 12, fontWeight: '600' },
  descriptionText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});