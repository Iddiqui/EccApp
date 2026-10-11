import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Star, User } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getMyTeacherProfile, getMyUpcomingSessionsAsTeacher } from './sessionService';

// Teacher home: profile summary + shortcuts. Only approved teachers (an active
// session_teachers document with their email, created by an admin) get here.

export default function TeacherDashboardScreen() {
  const navigation = useNavigation<any>();
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const colors = themeContext?.theme?.colors || {
    primary: '#2563EB',
    bgLight: isDarkMode ? '#090D16' : '#F8FAFC',
    bgCard: isDarkMode ? '#131B2E' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
  };
  const accent = colors.primary;

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<any | null>(null);
  const [upcoming, setUpcoming] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await getMyTeacherProfile();
      setTeacher(t);
      if (t) {
        const list = await getMyUpcomingSessionsAsTeacher();
        setUpcoming(list.length);
      }
    } catch (e) {
      console.error('TeacherDashboardScreen: load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const Item = ({
    emoji,
    title,
    sub,
    onPress,
    disabled,
  }: {
    emoji: string;
    title: string;
    sub: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.bgCard, borderColor: colors.border }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={[styles.itemIcon, { backgroundColor: accent + '1A' }]}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.itemSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      {!disabled && <ChevronRight color={colors.textSecondary} size={20} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.bgLight} />

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Teacher Dashboard</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : !teacher ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Your account does not have teacher access. Please contact the admin.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {teacher.photoUrl ? (
              <Image source={{ uri: teacher.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: accent + '1A', alignItems: 'center', justifyContent: 'center' }]}>
                <User color={accent} size={34} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{teacher.name}</Text>
              <Text style={[styles.email, { color: colors.textSecondary }]}>{teacher.email}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Star color="#F59E0B" size={14} fill="#F59E0B" />
                  <Text style={[styles.statText, { color: colors.textPrimary }]}>
                    {teacher.rating ? Number(teacher.rating).toFixed(1) : 'No ratings yet'}
                  </Text>
                </View>
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {upcoming ?? '-'} upcoming sessions
                </Text>
              </View>
            </View>
          </View>

          <Item
            emoji="📅"
            title="My Slots"
            sub="Add or delete your 1-to-1 session slots"
            onPress={() => navigation.navigate('TeacherSlotsScreen')}
          />
          <Item
            emoji="🎥"
            title="My Sessions"
            sub="Your booked sessions and Join button"
            onPress={() => navigation.navigate('UpcomingSessionsListScreen')}
          />
          <Item
            emoji="👤"
            title="My Profile"
            sub="Photo, intro video, bio and specialization"
            onPress={() => navigation.navigate('TeacherProfileEditScreen')}
          />
          <Item
            emoji="🎙️"
            title="Group Audio Classes"
            sub="Create and manage your live group classes"
            onPress={() => navigation.navigate('TeacherAudioSessionsScreen')}
          />

          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Your teacher access is managed by the admin. Your rating comes from student reviews and cannot be edited.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
  profileCard: { flexDirection: 'row', gap: 14, alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  name: { fontSize: 18, fontWeight: '800' },
  email: { fontSize: 12.5, marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12.5, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  itemIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15.5, fontWeight: '800' },
  itemSub: { fontSize: 12.5, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
});