import React, { useEffect, useState } from 'react';
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
// 🎯 Android status-bar overlap fix — same pattern as OneToOneSessionsScreen
// aur SlotSelectionScreen (RN ka built-in SafeAreaView sirf iOS pe kaam
// karta hai).
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Star, Clock, Globe, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getTeacherReviews, type Review } from './sessionService';
import type { Teacher } from './sessionTypes';

// ─────────────────────────────────────────────────────────────────────────
// Student ko teacher card tap karne par pehle YE detailed profile dikhta
// hai (bio, rating, reviews) — "Book a Slot" dabane par hi
// SlotSelectionScreen khulta hai. Poora `teacher` object OneToOneSessionsScreen
// se params me already aata hai (extra fetch nahi karna padta), sirf
// reviews yahan fetch hote hain.
// ─────────────────────────────────────────────────────────────────────────

function formatReviewDate(timestamp: any): string {
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function TeacherProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const teacher: Teacher = route.params?.teacher;

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

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    if (!teacher?.id) return;
    let isMounted = true;
    getTeacherReviews(teacher.id)
      .then((list) => {
        if (isMounted) setReviews(list);
      })
      .catch((err) => console.error('TeacherProfileScreen: getTeacherReviews error', err))
      .finally(() => {
        if (isMounted) setLoadingReviews(false);
      });
    return () => {
      isMounted = false;
    };
  }, [teacher?.id]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : teacher?.rating;

  if (!teacher) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.bgLight, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Teacher data missing.</Text>
      </SafeAreaView>
    );
  }

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Teacher Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Profile header card ── */}
        <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {teacher.photoUrl ? (
            <Image source={{ uri: teacher.photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {teacher.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={[styles.teacherName, { color: colors.textPrimary }]}>{teacher.name}</Text>
          {!!teacher.specialization && (
            <Text style={[styles.teacherSpecialization, { color: colors.textSecondary }]}>
              {teacher.specialization}
            </Text>
          )}

          <View style={styles.metaChipsRow}>
            {!!avgRating && (
              <View style={[styles.metaChip, { backgroundColor: colors.bgLight }]}>
                <Star color="#F59E0B" size={13} fill="#F59E0B" />
                <Text style={[styles.metaChipText, { color: colors.textPrimary }]}>
                  {avgRating.toFixed(1)} {reviews.length > 0 && `(${reviews.length})`}
                </Text>
              </View>
            )}
            <View style={[styles.metaChip, { backgroundColor: colors.bgLight }]}>
              <Clock color={colors.textSecondary} size={13} />
              <Text style={[styles.metaChipText, { color: colors.textPrimary }]}>
                {teacher.sessionDurationMins} min
              </Text>
            </View>
            {!!teacher.languages?.length && (
              <View style={[styles.metaChip, { backgroundColor: colors.bgLight }]}>
                <Globe color={colors.textSecondary} size={13} />
                <Text style={[styles.metaChipText, { color: colors.textPrimary }]}>
                  {teacher.languages.join(', ')}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Session Price</Text>
            <Text style={[styles.priceValue, { color: colors.primary }]}>
              ₹{teacher.pricePerSession}
            </Text>
          </View>
        </View>

        {/* ── Bio ── */}
        {!!teacher.bio && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
            <Text style={[styles.bioText, { color: colors.textSecondary }]}>{teacher.bio}</Text>
          </View>
        )}

        {/* ── Reviews ── */}
        <View style={styles.section}>
          <View style={styles.reviewsHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Reviews {reviews.length > 0 && `(${reviews.length})`}
            </Text>
          </View>

          {loadingReviews ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
          ) : reviews.length === 0 ? (
            <View style={[styles.emptyReviewsBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <MessageSquare color={colors.textSecondary} size={22} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyReviewsText, { color: colors.textSecondary }]}>
                There are no reviews yet. The first person to book a session can leave the first review!
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View
                key={review.id}
                style={[styles.reviewCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={styles.reviewTopRow}>
                  <Text style={[styles.reviewerName, { color: colors.textPrimary }]}>
                    {review.studentName || 'Student'}
                  </Text>
                  <View style={styles.reviewStarsRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        color="#F59E0B"
                        fill={i < Math.round(review.rating) ? '#F59E0B' : 'transparent'}
                        size={12}
                      />
                    ))}
                  </View>
                </View>
                {!!review.comment && (
                  <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>
                    {review.comment}
                  </Text>
                )}
                {!!review.createdAt && (
                  <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                    {formatReviewDate(review.createdAt)}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Sticky Book button ── */}
      <View style={[styles.bookBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.bookBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('SlotSelectionScreen', { teacher })}
          activeOpacity={0.85}
        >
          <Text style={styles.bookBtnText}>Book a Slot</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16 },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarImg: { width: 76, height: 76, borderRadius: 38, marginBottom: 12 },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 28, fontWeight: '700' },
  teacherName: { fontSize: 19, fontWeight: '700' },
  teacherSpecialization: { fontSize: 13, marginTop: 3 },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaChipText: { fontSize: 12, fontWeight: '600' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 20, fontWeight: '800' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  bioText: { fontSize: 13.5, lineHeight: 20 },
  reviewsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyReviewsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  emptyReviewsText: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { fontSize: 13.5, fontWeight: '700' },
  reviewStarsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  reviewDate: { fontSize: 11, marginTop: 8 },
  bookBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bookBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});