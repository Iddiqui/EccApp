import React, { useEffect, useMemo, useState } from 'react';
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
// 🎯 FIX: RN ka built-in SafeAreaView sirf iOS pe top-inset add karta hai —
// Android par ye kuch nahi karta, isliye header status bar (time/battery)
// ke peeche render ho raha tha aur back button ka touch area usi region me
// chala jaata tha (dead tap). react-native-safe-area-context cross-platform
// sahi kaam karta hai.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Clock, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getAvailableSlots, bookAndPaySession } from './sessionService';
import type { Teacher, TimeSlot } from './sessionTypes';
import { PaymentFlowModal } from '../payments/PaymentFlowScreens';
import type { PayMethod } from '../payments/paymentTypes';

// ─────────────────────────────────────────────────────────────────────────
// Student ek teacher ke liye date chunta hai, uske available slots dikhte
// hain (sirf wahi jo isBooked:false hain — admin ne banaaye the), ek slot
// select karke "Confirm & Pay" — jo bookAndPaySession() call karta hai
// (createBooking Cloud Function -> Razorpay checkout -> agar fail/cancel
// ho jaye to slot wapas free).
// ─────────────────────────────────────────────────────────────────────────

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
}

function buildNextDays(count: number) {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SlotSelectionScreen() {
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
    successGreen: '#10B981',
  };

  const nextDays = useMemo(() => buildNextDays(14), []);
  const [selectedDate, setSelectedDate] = useState<Date>(nextDays[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    if (!teacher?.id) return;
    let isMounted = true;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(teacher.id, toDateKey(selectedDate))
      .then(list => {
        if (isMounted) setSlots(list);
      })
      .catch(err => console.error('SlotSelectionScreen: getAvailableSlots error', err))
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });
    return () => {
      isMounted = false;
    };
  }, [teacher?.id, selectedDate]);

  // 🆕 Payment modal (method -> processing -> success). Booking/slot reserve
  // tab hota hai jab user method chun kar "Pay" dabata hai, isliye method
  // screen par baithe rehne se slot lock nahi hota.
  const [payOpen, setPayOpen] = useState(false);
  const slotPrice = selectedSlot?.price ?? teacher?.pricePerSession ?? 0;

  const refreshSlots = () => {
    if (!teacher) return;
    getAvailableSlots(teacher.id, toDateKey(selectedDate)).then(setSlots).catch(() => {});
  };

  const handleConfirm = () => {
    if (!selectedSlot || !teacher) return;
    setPayOpen(true);
  };

  const handlePay = (method: PayMethod) =>
    bookAndPaySession({ teacherId: teacher.id, slotId: selectedSlot!.id }, method);

  const handlePayError = (err: any) => {
    // User ne khud cancel kiya: chup-chap method screen par rehne do.
    if (err?.message === 'CANCELLED') return;

    if (err?.code === 'PENDING' || err?.code === 'REFUND') {
      // Paisa kat gaya — service ka message hi dikhao (slot free nahi kiya gaya)
      Alert.alert(err.code === 'REFUND' ? 'Refund Pending' : 'Payment Being Confirmed', err.message);
      setSelectedSlot(null);
      refreshSlots();
      return;
    }

    const taken = err?.message?.includes('already-exists') || err?.code === 'already-exists';
    if (taken) {
      setPayOpen(false);
      setSelectedSlot(null);
      refreshSlots();
      Alert.alert('Slot Already Booked', 'Someone else has just booked this slot. Please choose another slot.');
      return;
    }

    // Payment fail hui (paisa nahi kata) — modal method screen par wapas aa chuka hai
    console.error('SlotSelectionScreen: payment error', err);
    Alert.alert('Payment Failed', err?.message || 'The payment could not be completed. Please try again.');
  };

  if (!teacher) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight, alignItems: 'center', justifyContent: 'center' }]}>
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{teacher.name}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {teacher.specialization} · {teacher.sessionDurationMins} min
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {nextDays.map(d => {
            const active = toDateKey(d) === toDateKey(selectedDate);
            return (
              <TouchableOpacity
                key={toDateKey(d)}
                style={[
                  styles.dateChip,
                  { backgroundColor: active ? colors.primary : colors.bgCard, borderColor: colors.border, borderWidth: active ? 0 : 1 },
                ]}
                onPress={() => setSelectedDate(d)}
                activeOpacity={0.75}
              >
                <Text style={[styles.dateChipDay, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
                <Text style={[styles.dateChipNum, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                  {d.getDate()}
                </Text>
                <Text style={[styles.dateChipMonth, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                  {MONTH_LABELS[d.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 20 }]}>Available Slots</Text>
        {loadingSlots ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : slots.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Is date ke liye koi slot available nahi hai. Koi aur date try karo.
          </Text>
        ) : (
          <View style={styles.slotGrid}>
            {slots.map(slot => {
              const active = selectedSlot?.id === slot.id;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotChip,
                    { backgroundColor: active ? colors.primary : colors.bgCard, borderColor: colors.border, borderWidth: active ? 0 : 1 },
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                  activeOpacity={0.75}
                >
                  <Clock color={active ? '#FFFFFF' : colors.textSecondary} size={13} />
                  <Text style={[styles.slotChipText, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                    {formatTimeLabel(slot.startTime)}
                  </Text>
                  <Text style={[styles.slotChipPrice, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                    ₹{slot.price ?? teacher.pricePerSession}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {selectedSlot && (
        <View style={[styles.confirmBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
              {DAY_LABELS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_LABELS[selectedDate.getMonth()]} ·{' '}
              {formatTimeLabel(selectedSlot.startTime)} - {formatTimeLabel(selectedSlot.endTime)}
            </Text>
            <Text style={[styles.confirmPrice, { color: colors.textPrimary }]}>₹{slotPrice}</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <CheckCircle2 color="#FFFFFF" size={16} />
            <Text style={styles.confirmBtnText}>Confirm & Pay</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedSlot && (
        <PaymentFlowModal
          visible={payOpen}
          amountRupees={slotPrice}
          title={`1:1 with ${teacher.name}`}
          onPay={handlePay}
          onError={handlePayError}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            navigation.popToTop();
          }}
          successMessage="Your session has been booked. It will appear under Upcoming Sessions on the Home screen."
          successRows={[
            { label: 'Teacher', value: teacher.name },
            {
              label: 'Time',
              value: `${DAY_LABELS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTH_LABELS[selectedDate.getMonth()]} · ${formatTimeLabel(selectedSlot.startTime)}`,
            },
            { label: 'Amount Paid', value: `₹${slotPrice}` },
          ]}
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  scrollContent: { paddingHorizontal: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  dateStrip: { gap: 8, paddingRight: 8 },
  dateChip: { width: 56, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  dateChipDay: { fontSize: 11, fontWeight: '600' },
  dateChipNum: { fontSize: 16, fontWeight: '700', marginVertical: 2 },
  dateChipMonth: { fontSize: 11 },
  emptyText: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  slotChipText: { fontSize: 13, fontWeight: '600' },
  slotChipPrice: { fontSize: 11.5, fontWeight: '600' },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  confirmLabel: { fontSize: 11.5, fontWeight: '600' },
  confirmPrice: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
});