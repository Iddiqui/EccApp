import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  ChevronLeft, Flame, Mic, Trophy, Heart, BellOff,
  CalendarCheck, Headphones, CreditCard, Users, Target, Star, AtSign,
} from 'lucide-react-native';

import { useTheme } from '../../../hooks/useTheme';
import {
  AppNotification,
  getCachedNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  formatTimeAgo,
  navigateFromData,
} from '../../../services/notificationService'; // src/services/notificationService.ts

export type { AppNotification };

export default function NotificationScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const themeHook = useTheme() as any;
  const isDarkMode = themeHook?.isDarkMode || false;

  const colors = themeHook?.theme?.colors || {
    bgLight: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#2563EB',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
  };

  // ───────── REAL-TIME LISTENER (current user only) ─────────
  useEffect(() => {
    let active = true;
    let gotLiveData = false;

    // Show cached data first for an instant UI, until live data arrives
    getCachedNotifications().then(cached => {
      if (active && !gotLiveData && cached.length > 0) {
        setNotifications(cached);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToNotifications(
      items => {
        if (!active) return;
        gotLiveData = true;
        setNotifications(items);
        setError(false);
        setLoading(false);
        setRefreshing(false);
      },
      e => {
        console.error('Failed to listen for notifications:', e);
        if (!active) return;
        setError(true);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [reloadKey]);

  // When the user leaves this screen, everything they saw counts as read (this clears the red dot on Home)
  useEffect(() => {
    return () => {
      markAllNotificationsRead().catch(() => {});
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setReloadKey(k => k + 1);
  };

  // ───────── ACTIONS ─────────
  const hasUnread = notifications.some(n => n.unread);

  const handleMarkAllRead = async () => {
    if (!hasUnread) return;
    const snapshot = notifications;
    setNotifications(prev => prev.map(item => ({ ...item, unread: false })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.error('Failed to mark all as read:', e);
      setNotifications(snapshot); // roll back
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (item.unread) {
      setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, unread: false } : n)));
      markNotificationRead(item.id).catch(e => console.error('Failed to mark as read:', e));
    }
    navigateFromData(navigation, {
      type: item.type,
      targetRoomId: item.targetRoomId,
      targetBadgeId: item.targetBadgeId,
      targetScreen: item.targetScreen,
      targetTab: item.targetTab,
      targetGroupId: item.targetGroupId,
      targetMessageId: item.targetMessageId,
    });
  };

  // ───────── UI HELPERS ─────────
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
      case 'session':
        return { icon: <CalendarCheck size={22} color="#7C3AED" />, bg: isDarkMode ? '#3B0764' : '#F5F3FF' };
      case 'audio':
        return { icon: <Headphones size={22} color="#0891B2" />, bg: isDarkMode ? '#164E63' : '#ECFEFF' };
      case 'payment':
        return { icon: <CreditCard size={22} color="#16A34A" />, bg: isDarkMode ? '#14532D' : '#F0FDF4' };
      case 'mention':
        return { icon: <AtSign size={22} color="#4F46E5" />, bg: isDarkMode ? '#312E81' : '#EEF2FF' };
      case 'community':
        return { icon: <Users size={22} color="#DB2777" />, bg: isDarkMode ? '#831843' : '#FDF2F8' };
      case 'challenge':
        return { icon: <Target size={22} color="#EA580C" />, bg: isDarkMode ? '#7C2D12' : '#FFF7ED' };
      case 'review':
        return { icon: <Star size={22} color="#CA8A04" />, bg: isDarkMode ? '#713F12' : '#FEFCE8' };
      default:
        return { icon: <Mic size={22} color="#2563EB" />, bg: isDarkMode ? '#1E3A8A' : '#EFF6FF' };
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const { icon, bg } = renderIcon(item.type);
    const timeText = formatTimeAgo(item.createdAt);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          {
            backgroundColor: colors.bgCard,
            borderColor: item.unread ? colors.primary : colors.border,
            borderWidth: item.unread ? 1.5 : 1,
          },
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>{icon}</View>

        <View style={styles.textDetailsBlock}>
          <View style={styles.titleMetaRow}>
            <View style={styles.titleBadgeContainer}>
              <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              {item.unread && (
                <View style={[styles.unreadDotBlue, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeText}</Text>
          </View>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{item.desc}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyOrError = () => (
    <View style={styles.centerContainer}>
      <BellOff size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
        {error ? "Couldn't load notifications" : 'No notifications yet'}
      </Text>
      <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
        {error
          ? 'Check your internet connection and try again.'
          : "We'll notify you about your sessions, classes, plans, community and streak."}
      </Text>
      {error && (
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            setLoading(true);
            setError(false);
            setReloadKey(k => k + 1);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

          <TouchableOpacity
            style={[styles.markReadBtn, { opacity: hasUnread ? 1 : 0.4 }]}
            onPress={handleMarkAllRead}
            disabled={!hasUnread}
            activeOpacity={0.7}
          >
            <Text style={[styles.checkIcon, { color: colors.primary }]}>✓ </Text>
            <Text style={[styles.markReadText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContainer,
              notifications.length === 0 && { flexGrow: 1 },
            ]}
            ListEmptyComponent={renderEmptyOrError}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
          />
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
    paddingTop: Platform.OS === 'ios' ? 12 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20,
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
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginLeft: 12,
    letterSpacing: -0.4,
  },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkIcon: { fontSize: 15, fontWeight: '800' },
  markReadText: { fontSize: 13, fontWeight: '700' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySubText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
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
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textDetailsBlock: { flex: 1, paddingTop: 2 },
  titleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleBadgeContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  notifTitle: { fontSize: 15, fontWeight: '700' },
  unreadDotBlue: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  timeText: { fontSize: 12, fontWeight: '600' },
  descriptionText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});