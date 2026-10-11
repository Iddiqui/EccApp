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
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronDown, Clock, Star, Play, User, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import {
  getAllAvailableSlots,
  getTeachers,
  getDemoConfig,
  bookAndPaySession,
  localDateKey,
  type OpenSlot,
  type DemoConfig,
} from '../sessions/sessionService';
import { PaymentFlowModal } from '../payments/PaymentFlowScreens';
import type { PayMethod } from '../payments/paymentTypes';

// ─────────────────────────────────────────────────────────────────────────
// Demo (trial) class booking: one 1-to-1 class per student.
//   date strip -> time range -> tutor cards with slot chips -> Book Now
//   -> payment (price from admin config; free if the price is 0)
// Tutor name / photo opens the existing TeacherProfileScreen.
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

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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

export default function DemoClassScreen() {
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

  const days = useMemo(() => buildNextDays(7), []);
  const [dateKey, setDateKey] = useState(localDateKey(days[0]));
  const [hour, setHour] = useState<number>(ALL_DAY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<number>(ALL_DAY);
  const [filter, setFilter] = useState('All Tutors');

  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [teachers, setTeachers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<OpenSlot | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cfg, slotList, teacherList] = await Promise.all([
        getDemoConfig(),
        getAllAvailableSlots(),
        getTeachers(),
      ]);
      setConfig(cfg);
      setSlots(slotList);
      const map: Record<string, any> = {};
      teacherList.forEach((t: any) => (map[t.id] = t));
      setTeachers(map);
    } catch (err) {
      console.error('DemoClassScreen: load error', err);
      Alert.alert('Error', 'Could not load demo class slots. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only active video teachers, slots on the chosen day, inside the chosen hour
  const cards = useMemo(() => {
    const byTeacher: Record<string, OpenSlot[]> = {};
    slots.forEach((s) => {
      const t = teachers[s.teacherId];
      if (!t || t.isActive === false) return;
      if (Array.isArray(t.modes) && !t.modes.includes('video')) return;
      if (s.date !== dateKey) return;
      if (hour !== ALL_DAY && parseInt(s.startTime.split(':')[0], 10) !== hour) return;
      (byTeacher[s.teacherId] = byTeacher[s.teacherId] || []).push(s);
    });
    return Object.entries(byTeacher)
      .map(([teacherId, list]) => ({
        teacher: teachers[teacherId],
        slots: list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
      .filter((c) => {
        if (filter === 'All Tutors') return true;
        return String(c.teacher.specialization || '').trim() === filter;
      });
  }, [slots, teachers, dateKey, hour, filter]);

  const filterChips = useMemo(() => {
    const set = new Set<string>();
    Object.values(teachers).forEach((t: any) => {
      const sp = String(t.specialization || '').trim();
      if (sp && sp.toLowerCase() !== 'general') set.add(sp);
    });
    return ['All Tutors', ...Array.from(set)];
  }, [teachers]);

  // A selected slot that is filtered out should be cleared
  useEffect(() => {
    if (selected && !cards.some((c) => c.slots.some((s) => s.id === selected.id))) {
      setSelected(null);
    }
  }, [cards]); // eslint-disable-line react-hooks/exhaustive-deps

  const price = config?.price ?? 0;

  const handleBookNow = () => {
    if (!selected || !config) return;
    if (price === 0) {
      Alert.alert(
        'Confirm Demo Class',
        `Book your free demo class with ${selected.teacherName} on ${selected.date} at ${timeLabel(selected.startTime)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Book', onPress: bookFree },
        ]
      );
    } else {
      setPayOpen(true);
    }
  };

  const handleError = (err: any) => {
    if (err?.message === 'CANCELLED') return;
    if (err?.code === 'PENDING' || err?.code === 'REFUND') {
      Alert.alert(err.code === 'REFUND' ? 'Refund Pending' : 'Payment Being Confirmed', err.message);
      load();
      return;
    }
    const msg = String(err?.message || '');
    if (err?.code === 'already-exists' || err?.code === 'functions/already-exists' || msg.includes('already')) {
      setPayOpen(false);
      setSelected(null);
      load();
      Alert.alert('Not Available', msg || 'This slot is no longer available. Please choose another slot.');
      return;
    }
    console.error('DemoClassScreen: booking error', err);
    Alert.alert('Booking Failed', msg || 'The demo class could not be booked. Please try again.');
  };

  const bookFree = async () => {
    if (!selected || booking) return;
    setBooking(true);
    try {
      await bookAndPaySession({ teacherId: selected.teacherId, slotId: selected.id }, undefined, 'demo');
      Alert.alert('Demo Class Booked', 'Your demo class is confirmed. You can find it under My Sessions.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setBooking(false);
    }
  };

  const handlePay = (method: PayMethod) =>
    bookAndPaySession({ teacherId: selected!.teacherId, slotId: selected!.id }, method, 'demo');

  const renderBody = () => {
    if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 40 }} />;

    if (!config?.isActive) {
      return (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Demo classes are not available right now. Please check back later.
        </Text>
      );
    }
    if (config.alreadyUsed) {
      return (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          You have already used your demo class. Choose a Video Mode plan to continue learning with your tutor.
        </Text>
      );
    }

    return (
      <>
        <View style={[styles.banner, { backgroundColor: accent + '14', borderColor: accent + '40' }]}>
          <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
            Try a 1-on-1 demo class with your tutor{' '}
            <Text style={{ fontWeight: '800', color: accent }}>{price === 0 ? 'for free' : `at just ${money(price)}`}</Text>
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>Choose Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
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
                <Text style={[styles.dateDay, { color: active ? '#FFF' : colors.textSecondary }]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {filterChips.map((chip) => {
            const active = chip === filter;
            return (
              <TouchableOpacity
                key={chip}
                onPress={() => setFilter(chip)}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? accent + '18' : colors.bgCard, borderColor: active ? accent : colors.border },
                ]}
              >
                <Text style={{ color: active ? accent : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {cards.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No tutors have open slots for this date and time. Try another date or time.
          </Text>
        ) : (
          <View style={{ gap: 14 }}>
            {cards.map(({ teacher, slots: list }) => {
              const hasSelected = selected?.teacherId === teacher.id;
              const openProfile = () => navigation.navigate('TeacherProfileScreen', { teacher });
              return (
                <View key={teacher.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    <TouchableOpacity activeOpacity={0.85} onPress={openProfile}>
                      <View style={[styles.photoBox, { backgroundColor: accent + '14' }]}>
                        {teacher.photoUrl ? (
                          <Image source={{ uri: teacher.photoUrl }} style={styles.photo} />
                        ) : (
                          <User color={accent} size={40} />
                        )}
                        {!!teacher.introVideoUrl && (
                          <View style={styles.playBadge}>
                            <Play color="#FFF" size={14} fill="#FFF" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {teacher.name}
                      </Text>
                      <View style={styles.ratingRow}>
                        {!!teacher.rating && (
                          <>
                            <Star color="#F59E0B" size={14} fill="#F59E0B" />
                            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                              {Number(teacher.rating).toFixed(1)}
                            </Text>
                          </>
                        )}
                        <TouchableOpacity onPress={openProfile} hitSlop={8}>
                          <Text style={[styles.profileLink, { color: accent }]}>View Profile</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.slotLabel, { color: colors.textPrimary }]}>Select a slot</Text>
                  <View style={styles.slotWrap}>
                    {list.map((s) => {
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

                  <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: hasSelected ? accent : accent + '22' }]}
                    disabled={!hasSelected || booking}
                    onPress={handleBookNow}
                    activeOpacity={0.85}
                  >
                    {booking && hasSelected ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: hasSelected ? '#FFF' : accent, fontWeight: '800', fontSize: 14 }}>
                        {hasSelected ? (price === 0 ? 'Book Now · Free' : `Book Now @${price}`) : 'Select a slot to book'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </>
    );
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Book a Demo Class</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>{renderBody()}</ScrollView>

      {/* Time range picker */}
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
              <TouchableOpacity
                style={[styles.sheetBtn, { borderColor: accent, borderWidth: 1.5 }]}
                onPress={() => setPickerOpen(false)}
              >
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

      {!!selected && price > 0 && (
        <PaymentFlowModal
          visible={payOpen}
          amountRupees={price}
          title={`Demo class with ${selected.teacherName}`}
          onPay={handlePay}
          onError={handleError}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            navigation.popToTop();
          }}
          successMessage="Your demo class is booked. You can find it under My Sessions."
          successRows={[
            { label: 'Tutor', value: selected.teacherName },
            { label: 'Date', value: selected.date },
            { label: 'Time', value: `${timeLabel(selected.startTime)} - ${timeLabel(selected.endTime)}` },
            { label: 'Amount Paid', value: money(price) },
          ]}
          primaryLabel="Go to My Dashboard"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },

  banner: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 6 },
  bannerText: { fontSize: 13.5, lineHeight: 20 },

  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  dateStrip: { gap: 8, paddingRight: 8 },
  dateChip: { width: 68, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  dateDay: { fontSize: 12, fontWeight: '600' },
  dateNum: { fontSize: 18, fontWeight: '800', marginTop: 2 },

  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  timeText: { flex: 1, fontSize: 14.5, fontWeight: '600' },

  chipsRow: { gap: 8, paddingVertical: 14 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },

  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  photoBox: { width: 96, height: 96, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  playBadge: { position: 'absolute', bottom: 8, left: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  tName: { fontSize: 20, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  profileLink: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  heading: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  tzText: { fontSize: 13, marginTop: 12 },
  slotLabel: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 10 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ratingText: { fontSize: 14, fontWeight: '700' },
  slotChip: { width: '48%', borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  bookBtn: { marginTop: 16, borderRadius: 26, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },

  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  pickerRow: { paddingVertical: 14, borderRadius: 10 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetBtn: { flex: 1, borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
});