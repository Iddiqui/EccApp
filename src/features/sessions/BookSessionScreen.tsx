import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronDown, Clock, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getAvailableSlots, bookSubscriptionSession, localDateKey } from './sessionService';
import { getMySubscriptions } from '../payments/paymentService';
import type { ProgramAccess } from '../payments/paymentTypes';
import type { TimeSlot } from './sessionTypes';

// ─────────────────────────────────────────────────────────────────────────
// Book a session with a Video plan:
//   plan summary -> date -> time range -> slots of the ASSIGNED teacher -> Book
// No payment: one session of the plan is used (the server enforces everything).
// ─────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAY = -1;
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};
const hourLabel = (h: number) => {
  return `${pad(h % 24)}:00`;
};
const rangeLabel = (h: number) => (h === ALL_DAY ? 'All day' : `${hourLabel(h)} - ${hourLabel((h + 1) % 24)}`);
const dateLabel = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function BookSessionScreen() {
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

  const [sub, setSub] = useState<ProgramAccess | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  const [dateKey, setDateKey] = useState(localDateKey());
  const [hour, setHour] = useState<number>(ALL_DAY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<number>(ALL_DAY);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [booking, setBooking] = useState(false);

  const loadSub = useCallback(async () => {
    try {
      const subs = await getMySubscriptions();
      setSub(subs.video);
    } catch (err) {
      console.error('BookSessionScreen: subscription error', err);
      Alert.alert('Error', 'Could not load your plan. Please try again.');
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    loadSub();
  }, [loadSub]);

  // Dates: today up to 14 days, never beyond the plan's expiry
  const days = useMemo(() => {
    const list: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (sub?.expiresAt && d.getTime() > sub.expiresAt) break;
      list.push(d);
    }
    return list;
  }, [sub?.expiresAt]);

  const hasPlan = !!sub && sub.active;
  const teacherId = sub?.teacherId;

  const loadSlots = useCallback(async () => {
    if (!teacherId) return;
    setLoadingSlots(true);
    setSelected(null);
    try {
      setSlots(await getAvailableSlots(teacherId, dateKey));
    } catch (err) {
      console.error('BookSessionScreen: slots error', err);
    } finally {
      setLoadingSlots(false);
    }
  }, [teacherId, dateKey]);

  useEffect(() => {
    if (hasPlan) loadSlots();
  }, [hasPlan, loadSlots]);

  const visibleSlots = useMemo(
    () =>
      slots.filter((s) => hour === ALL_DAY || parseInt(s.startTime.split(':')[0], 10) === hour),
    [slots, hour]
  );

  const confirmBooking = () => {
    if (!selected || !sub || booking) return;
    Alert.alert(
      'Confirm Session',
      `Book ${dateKey} at ${timeLabel(selected.startTime)} with ${sub.teacherName}?\n\nThis will use 1 of your ${sub.remainingSessions} remaining sessions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book', onPress: doBook },
      ]
    );
  };

  const doBook = async () => {
    if (!selected || !teacherId) return;
    setBooking(true);
    try {
      const res = await bookSubscriptionSession({ teacherId, slotId: selected.id });
      Alert.alert(
        'Session Booked',
        `Your session is confirmed. You have ${res.remainingSessions} sessions left in your plan.`,
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch (err: any) {
      const msg = String(err?.message || '');
      console.error('BookSessionScreen: booking error', err);
      Alert.alert('Booking Failed', msg || 'The session could not be booked. Please try again.');
      loadSlots();
      loadSub();
    } finally {
      setBooking(false);
    }
  };

  const renderBody = () => {
    if (loadingSub) return <ActivityIndicator color={accent} style={{ marginTop: 40 }} />;

    if (!sub || (!sub.active && sub.reason !== 'no_sessions_left')) {
      return (
        <View style={{ alignItems: 'center', marginTop: 40, gap: 16, paddingHorizontal: 24 }}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {sub?.reason === 'expired'
              ? 'Your Video plan has expired. Renew it to book sessions.'
              : 'You need an active Video plan to book sessions.'}
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() => navigation.replace('ProgramFlowScreen', { mode: 'video' })}
          >
            <Text style={styles.primaryBtnText}>Choose your plan</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (sub.reason === 'no_sessions_left') {
      return (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          You have used all sessions included in your current plan. You can buy a new plan after it expires on{' '}
          {dateLabel(sub.expiresAt)}.
        </Text>
      );
    }

    return (
      <>
        <View style={[styles.planCard, { backgroundColor: accent + '14', borderColor: accent + '55' }]}>
          <Text style={[styles.planTitle, { color: colors.textPrimary }]}>{sub.planName}</Text>
          <Text style={[styles.planSub, { color: colors.textSecondary }]}>
            Teacher: <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{sub.teacherName}</Text>
          </Text>
          <View style={styles.planRow}>
            <Text style={[styles.planStat, { color: accent }]}>
              {sub.remainingSessions} of {sub.totalSessions} sessions left
            </Text>
            <Text style={[styles.planSub, { color: colors.textSecondary }]}>Valid till {dateLabel(sub.expiresAt)}</Text>
          </View>
        </View>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>Choose Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {days.map((d) => {
            const key = localDateKey(d);
            const active = key === dateKey;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setDateKey(key)}
                activeOpacity={0.8}
                style={[
                  styles.dateChip,
                  { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border },
                ]}
              >
                <Text style={[styles.dateDay, { color: active ? '#FFF' : colors.textSecondary }]}>{DAY_LABELS[d.getDay()]}</Text>
                <Text style={[styles.dateNum, { color: active ? '#FFF' : colors.textPrimary }]}>{d.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[styles.tzText, { color: colors.textSecondary }]}>
          Times are shown in India time:{' '}
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Asia/Kolkata (IST)</Text>
        </Text>

        <Text style={[styles.heading, { color: colors.textPrimary, marginTop: 14 }]}>Choose Time</Text>
        <TouchableOpacity
          style={[styles.timeBox, { backgroundColor: accent + '14', borderColor: accent }]}
          onPress={() => {
            setPickerValue(hour);
            setPickerOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Clock color={colors.textSecondary} size={16} />
          <Text style={[styles.timeText, { color: colors.textPrimary }]}>{rangeLabel(hour)}</Text>
          <ChevronDown color={colors.textSecondary} size={18} />
        </TouchableOpacity>

        <Text style={[styles.heading, { color: colors.textPrimary, marginTop: 18 }]}>Select a slot</Text>
        {loadingSlots ? (
          <ActivityIndicator color={accent} style={{ marginTop: 16 }} />
        ) : visibleSlots.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No open slots with {sub.teacherName} for this date and time. Try another date or time.
          </Text>
        ) : (
          <View style={styles.slotWrap}>
            {visibleSlots.map((s) => {
              const active = selected?.id === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(s)}
                  activeOpacity={0.8}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: active ? accent + '14' : 'transparent',
                      borderColor: active ? accent : colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: active ? accent : colors.textPrimary, fontSize: 13, fontWeight: active ? '800' : '600' }}>
                    {timeLabel(s.startTime)} - {timeLabel(s.endTime)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  };

  const canBook = hasPlan && !!selected;

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Book a Session</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>{renderBody()}</ScrollView>

      {hasPlan && (
        <View style={[styles.footer, { backgroundColor: colors.bgLight, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }, (!canBook || booking) && { opacity: 0.45 }]}
            disabled={!canBook || booking}
            onPress={confirmBooking}
            activeOpacity={0.85}
          >
            {booking ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>{selected ? 'Book Session' : 'Select a slot to book'}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.bgCard }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Choose time</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={12}>
                <X color={colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[ALL_DAY, ...Array.from({ length: 24 }, (_, i) => i)]}
              keyExtractor={(h) => String(h)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const active = item === pickerValue;
                return (
                  <TouchableOpacity
                    onPress={() => setPickerValue(item)}
                    style={[styles.pickerRow, active && { backgroundColor: accent + '14' }]}
                  >
                    <Text
                      style={{
                        color: active ? accent : colors.textPrimary,
                        fontSize: 16,
                        fontWeight: active ? '800' : '500',
                        textAlign: 'center',
                      }}
                    >
                      {rangeLabel(item)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, { borderColor: accent, borderWidth: 1.5 }]} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: accent, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: accent }]}
                onPress={() => {
                  setHour(pickerValue);
                  setPickerOpen(false);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { borderRadius: 26, paddingVertical: 15, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  planCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4, marginBottom: 4 },
  planTitle: { fontSize: 16, fontWeight: '800' },
  planSub: { fontSize: 13 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  planStat: { fontSize: 14, fontWeight: '800' },

  heading: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  dateChip: { width: 68, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  dateDay: { fontSize: 12, fontWeight: '600' },
  dateNum: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  tzText: { fontSize: 13, marginTop: 12 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  timeText: { flex: 1, fontSize: 14.5, fontWeight: '600' },

  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { width: '48%', borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 24, paddingHorizontal: 12, lineHeight: 20 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  pickerRow: { paddingVertical: 14, borderRadius: 10 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetBtn: { flex: 1, borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
});