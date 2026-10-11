import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
// 🎯 FIX: same Android status-bar overlap issue as SlotSelectionScreen —
// RN's own SafeAreaView doesn't add a top inset on Android.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Search, Star, Clock, Globe } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getTeachers } from './sessionService';
import type { Teacher } from './sessionTypes';

// ─────────────────────────────────────────────────────────────────────────
// Student ke liye: teachers browse karna 1-to-1 session book karne se
// pehle. Teacher card tap karne par ab pehle TeacherProfileScreen khulta
// hai (bio, rating, reviews dikhane ke liye) — poora teacher object params
// me pass karte hain (extra fetch bachane ke liye). Wahan se "Book a Slot"
// dabane par hi SlotSelectionScreen khulta hai.
// ─────────────────────────────────────────────────────────────────────────

export default function OneToOneSessionsScreen() {
  const navigation = useNavigation<any>();
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;

  const colors = themeContext?.theme?.colors || {
    primary: '#6366F1',
    bgLight: isDarkMode ? '#090D16' : '#F8FAFC',
    bgCard: isDarkMode ? '#131B2E' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
  };

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    getTeachers()
      .then(list => {
        if (isMounted) setTeachers(list);
      })
      .catch(err => console.error('OneToOneSessionsScreen: getTeachers error', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.trim().toLowerCase();
    return teachers.filter(
      t => t.name.toLowerCase().includes(q) || (t.specialization || '').toLowerCase().includes(q)
    );
  }, [teachers, search]);

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Book a 1-to-1 Session</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Choose a teacher and book your slot
          </Text>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Search color={colors.textSecondary} size={16} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="By searching teacher or specialization..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
        />
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filteredTeachers.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {teachers.length === 0 ? 'No teacher is available right now.' : 'I couldn not find a teacher.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredTeachers.map(teacher => (
            <TouchableOpacity
              key={teacher.id}
              style={[styles.teacherCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.navigate('TeacherProfileScreen', { teacher })}
              activeOpacity={0.85}
            >
              <View style={styles.teacherRow}>
                {teacher.photoUrl ? (
                  <Image source={{ uri: teacher.photoUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                      {teacher.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teacherName, { color: colors.textPrimary }]}>{teacher.name}</Text>
                  {!!teacher.specialization && (
                    <Text style={[styles.teacherSpecialization, { color: colors.textSecondary }]}>
                      {teacher.specialization}
                    </Text>
                  )}
                  <View style={styles.metaRow}>
                    <Clock color={colors.textSecondary} size={12} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {teacher.sessionDurationMins} min
                    </Text>
                    {!!teacher.rating && (
                      <>
                        <Star color="#F59E0B" size={12} fill="#F59E0B" style={{ marginLeft: 10 }} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {teacher.rating.toFixed(1)}
                        </Text>
                      </>
                    )}
                  </View>
                  {!!teacher.languages?.length && (
                    <View style={styles.metaRow}>
                      <Globe color={colors.textSecondary} size={12} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {teacher.languages.join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceBox}>
                  <Text style={[styles.priceText, { color: colors.primary }]}>₹{teacher.pricePerSession}</Text>
                  <Text style={[styles.priceSubText, { color: colors.textSecondary }]}>/session</Text>
                </View>
              </View>
              {!!teacher.bio && (
                <Text
                  style={[styles.bioText, { color: colors.textSecondary, borderTopColor: colors.border }]}
                  numberOfLines={2}
                >
                  {teacher.bio}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  scrollContent: { paddingHorizontal: 16 },
  teacherCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  teacherRow: { flexDirection: 'row', gap: 12 },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700' },
  teacherName: { fontSize: 15, fontWeight: '700' },
  teacherSpecialization: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 4 },
  metaText: { fontSize: 11.5, fontWeight: '600' },
  priceBox: { alignItems: 'flex-end', justifyContent: 'center' },
  priceText: { fontSize: 16, fontWeight: '800' },
  priceSubText: { fontSize: 10 },
  bioText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});