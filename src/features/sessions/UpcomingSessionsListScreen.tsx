import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
// 🎯 FIX: react-native ka SafeAreaView Android par top-inset add nahi karta
// (sirf iOS pe kaam karta hai) — isliye header status bar ke peeche chala
// jaata. react-native-safe-area-context cross-platform sahi kaam karta hai.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Calendar } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import {
  checkIsHost,
  getMyUpcomingSessionsAsStudent,
  getMyUpcomingSessionsAsTeacher,
  getAllAvailableSlots,
  bookAndPaySession,
  joinVideoSession,
  cancelBooking,
  localDateKey,
  type OpenSlot,
} from './sessionService';
import type { Booking } from './sessionTypes';
import { PaymentFlowModal } from '../payments/PaymentFlowScreens';
import type { PayMethod } from '../payments/paymentTypes';

// ─────────────────────────────────────────────────────────────────────────
// HomeScreen ke "Book 1-1 Session" card ka "See all" isi screen par leke
// aata hai — Home par sirf top 3 (booked+open combined) preview ke tor par
// dikhte hain, poori list yahan do saaf sections me dikhti hai:
//   1. "My Sessions" — jo already book+pay ho chuki hain (JOIN karne ke liye)
//   2. "Available Slots" — sab teachers ke open slots (BOOK karne ke liye)
// ─────────────────────────────────────────────────────────────────────────

function isSessionJoinable(session: Booking) {
  const sessionDateTime = new Date(`${session.date}T${session.startTime}:00`);
  const now = new Date();
  const minutesUntilStart = (sessionDateTime.getTime() - now.getTime()) / 60000;
  return minutesUntilStart <= 10 && minutesUntilStart > -60;
}

export default function UpcomingSessionsListScreen() {
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

  const [sessions, setSessions] = useState<Booking[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // 🆕 OPEN/AVAILABLE SLOTS section state
  const [availableSlots, setAvailableSlots] = useState<OpenSlot[]>([]);
  // 🆕 Jis slot ka payment modal khula hai (null = band)
  const [payingSlot, setPayingSlot] = useState<OpenSlot | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const isHost = await checkIsHost();
      const list = isHost
        ? await getMyUpcomingSessionsAsTeacher()
        : await getMyUpcomingSessionsAsStudent();
      setIsTeacher(isHost);
      setSessions(list);

    } catch (err) {
      console.error('UpcomingSessionsListScreen: load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const unsub = navigation.addListener('focus', loadSessions);
    return unsub;
  }, [navigation, loadSessions]);

  // Plan sessions can be cancelled up to 2 hours before the start (the server enforces this too)
  const canCancel = (session: Booking) => {
    if (isTeacher || session.kind !== 'subscription') return false;
    const start = new Date(`${session.date}T${session.startTime}:00`).getTime();
    return start - Date.now() >= 2 * 60 * 60 * 1000;
  };

  const handleCancel = (session: Booking) => {
    Alert.alert(
      'Cancel this session?',
      'The session will be returned to your plan and the slot will be released.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel session',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBooking(session.id);
              Alert.alert('Session Cancelled', 'The session has been returned to your plan.');
              loadSessions();
            } catch (err: any) {
              Alert.alert('Could Not Cancel', err?.message || 'The session could not be cancelled. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleJoin = async (session: Booking) => {
    if (joiningId) return;
    if (!isSessionJoinable(session)) {
      Alert.alert(
        'Not yet',
        `This session starts on ${session.date} at ${session.startTime}. The Join button becomes active 10 minutes before the start time.`
      );
      return;
    }
    setJoiningId(session.id);
    try {
      const { serverUrl, token, otherPersonName, bookingId } = await joinVideoSession(session);
      navigation.navigate('VideoSessionScreen', {
        serverUrl,
        token,
        otherPersonName,
        bookingId,
      });
    } catch (err: any) {
      console.error('UpcomingSessionsListScreen: join error', err?.code, err?.message, err);
      // Server ka asli message (jaise "Session abhi shuru nahi hua") dikhao
      Alert.alert('Error', err?.message || 'Could not join the session. Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  // 🆕 Book Now -> payment modal (method -> processing -> success).
  // Slot reserve tab hota hai jab user method chun kar Pay dabata hai.
  const slotPrice = (slot: OpenSlot) => slot.price ?? slot.teacherPricePerSession;

  const handleBookSlot = (slot: OpenSlot) => {
    if (payingSlot) return;
    setPayingSlot(slot);
  };

  const handlePay = (method: PayMethod) =>
    bookAndPaySession({ teacherId: payingSlot!.teacherId, slotId: payingSlot!.id }, method);

  const handlePayError = (err: any) => {
    // User ne khud cancel kiya: method screen par hi rehne do
    if (err?.message === 'CANCELLED') return;

    if (err?.code === 'PENDING' || err?.code === 'REFUND') {
      Alert.alert(err.code === 'REFUND' ? 'Refund Pending' : 'Payment Being Confirmed', err.message);
      loadSessions();
      return;
    }

    if (err?.message?.includes('already-exists') || err?.code === 'already-exists') {
      setPayingSlot(null);
      Alert.alert('Slot Already Booked', 'Someone else has just booked this slot. Please choose another slot.');
      getAllAvailableSlots().then(setAvailableSlots).catch(() => {});
      return;
    }

    console.error('UpcomingSessionsListScreen: payment error', err);
    Alert.alert('Payment Failed', err?.message || 'The payment could not be completed. Please try again.');
  };

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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Upcoming Sessions</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isTeacher ? 'Your teaching schedule' : 'Your booked sessions'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Calendar color={colors.textSecondary} size={32} style={{ marginBottom: 10 }} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isTeacher
              ? 'No upcoming sessions are scheduled.'
              : 'No upcoming sessions yet. Book a trial class or choose a plan to get started.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ── SECTION 1: MY SESSIONS (confirmed, JOIN karne ke liye) ── */}
          {sessions.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                {isTeacher ? 'My Teaching Schedule' : 'My Sessions'}
              </Text>
              {sessions.map((session) => {
                const joinable = isSessionJoinable(session);
                const isJoiningThis = joiningId === session.id;
                const displayName = isTeacher ? 'Student' : session.teacherName;

                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[styles.sessionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => handleJoin(session)}
                    activeOpacity={0.85}
                    disabled={isJoiningThis}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionDate, { color: colors.primary }]}>
                        📅 {session.date === localDateKey() ? 'Today' : session.date}, {session.startTime}
                      </Text>
                      <Text style={[styles.sessionTitle, { color: colors.textPrimary }]}>
                        1:1 with {displayName}
                      </Text>
                      <Text style={[styles.sessionSub, { color: colors.textSecondary }]}>
                        {session.startTime} - {session.endTime}
                        {session.kind === 'demo' ? ' · Demo class' : session.kind === 'subscription' ? ' · Included in your plan' : ` · ₹${session.price}`}
                      </Text>
                      {canCancel(session) && (
                        <TouchableOpacity onPress={() => handleCancel(session)} hitSlop={8} style={{ marginTop: 6 }}>
                          <Text style={{ color: '#DC2626', fontSize: 12.5, fontWeight: '700' }}>Cancel session</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {isJoiningThis ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: joinable ? '#22C55E' : colors.textSecondary }}>
                        {joinable ? '● Join Now' : 'Not started'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {payingSlot && (
        <PaymentFlowModal
          visible
          amountRupees={slotPrice(payingSlot)}
          title={`1:1 with ${payingSlot.teacherName}`}
          onPay={handlePay}
          onError={handlePayError}
          onClose={() => setPayingSlot(null)}
          onDone={() => {
            setPayingSlot(null);
            loadSessions();
          }}
          successMessage="Your session has been booked. It will now appear under My Sessions."
          successRows={[
            { label: 'Teacher', value: payingSlot.teacherName },
            { label: 'Time', value: `${payingSlot.date}, ${payingSlot.startTime} - ${payingSlot.endTime}` },
            { label: 'Amount Paid', value: `₹${slotPrice(payingSlot)}` },
          ]}
          primaryLabel="Done"
        />
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
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sessionDate: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  sessionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sessionSub: { fontSize: 12.5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { fontSize: 13.5, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  bookBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  bookBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
});