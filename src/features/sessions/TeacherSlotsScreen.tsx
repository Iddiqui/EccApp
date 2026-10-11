import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getMyTeacherProfile, localDateKey } from './sessionService';

// A teacher creates and deletes their OWN 1-to-1 slots here. Students book them with
// a Video plan (or a demo class). Slots carry no price: plan sessions are paid by the plan.

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
// 24-hour display, e.g. 14:30
const label = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};

// 06:00 to 23:30, every 30 minutes (teachers can also type any custom time)
const START_TIMES: string[] = [];
for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) START_TIMES.push(fromMin(m));

export default function TeacherSlotsScreen() {
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

  const [teacher, setTeacher] = useState<any | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(true);
  const [dateKey, setDateKey] = useState(localDateKey());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [daySlots, setDaySlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customHour, setCustomHour] = useState('');
  const [customMin, setCustomMin] = useState('');
  const [customTimes, setCustomTimes] = useState<string[]>([]);

  const duration: number = teacher?.sessionDurationMins || 30;

  const days = useMemo(() => {
    const list: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  useEffect(() => {
    getMyTeacherProfile()
      .then(setTeacher)
      .catch((e) => console.error('TeacherSlotsScreen: teacher error', e))
      .finally(() => setLoadingTeacher(false));
  }, []);

  const loadDay = useCallback(async () => {
    if (!teacher) return;
    setLoadingSlots(true);
    setPicked(new Set());
    setCustomTimes([]);
    try {
      const snap = await firestore()
        .collection('session_teachers')
        .doc(teacher.id)
        .collection('slots')
        .where('date', '==', dateKey)
        .get();
      setDaySlots(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
      );
    } catch (e) {
      console.error('TeacherSlotsScreen: slots error', e);
    } finally {
      setLoadingSlots(false);
    }
  }, [teacher, dateKey]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const isPast = (t: string) => new Date(`${dateKey}T${t}:00`).getTime() <= Date.now();
  const overlapsExisting = (t: string) => {
    const s = toMin(t);
    const e = s + duration;
    return daySlots.some((x) => s < toMin(x.endTime) && e > toMin(x.startTime));
  };

  const addCustomTime = () => {
    const h = parseInt(customHour, 10);
    const m = parseInt(customMin === '' ? '0' : customMin, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Invalid time', 'Enter hour 0-23 and minutes 0-59 (24-hour format).');
      return;
    }
    const t = `${pad(h)}:${pad(m)}`;
    if (toMin(t) + duration > 24 * 60) {
      Alert.alert('Invalid time', `A ${duration}-minute session must finish before midnight.`);
      return;
    }
    if (isPast(t)) {
      Alert.alert('Invalid time', 'This time has already passed for the selected date.');
      return;
    }
    if (overlapsExisting(t)) {
      Alert.alert('Time Overlap', 'This time overlaps with an existing slot.');
      return;
    }
    if (!START_TIMES.includes(t) && !customTimes.includes(t)) {
      setCustomTimes((prev) => [...prev, t].sort());
    }
    setPicked((prev) => new Set(prev).add(t));
    setCustomHour('');
    setCustomMin('');
    Keyboard.dismiss();
  };

  const toggle = (t: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const addSlots = async () => {
    if (!teacher || picked.size === 0 || saving) return;
    const times = Array.from(picked).sort();
    for (let i = 1; i < times.length; i++) {
      if (toMin(times[i]) < toMin(times[i - 1]) + duration) {
        Alert.alert('Times Overlap', `Each session is ${duration} minutes. Pick start times at least ${duration} minutes apart.`);
        return;
      }
    }
    setSaving(true);
    try {
      const batch = firestore().batch();
      const col = firestore().collection('session_teachers').doc(teacher.id).collection('slots');
      times.forEach((t) => {
        batch.set(col.doc(), {
          teacherId: teacher.id,
          date: dateKey,
          startTime: t,
          endTime: fromMin(toMin(t) + duration),
          isBooked: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      Alert.alert('Done', `${times.length} slot(s) added.`);
      await loadDay();
    } catch (e: any) {
      console.error('TeacherSlotsScreen: add error', e);
      Alert.alert('Error', 'Could not save the slots. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = (slot: any) => {
    if (slot.isBooked) {
      Alert.alert('Not Allowed', 'This slot is already booked and cannot be deleted.');
      return;
    }
    Alert.alert('Delete this slot?', `${label(slot.startTime)} - ${label(slot.endTime)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('session_teachers').doc(teacher.id).collection('slots').doc(slot.id).delete();
            await loadDay();
          } catch (e) {
            console.error('TeacherSlotsScreen: delete error', e);
            Alert.alert('Error', 'Could not delete the slot.');
          }
        },
      },
    ]);
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Slots</Text>
      </View>

      {loadingTeacher ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : !teacher ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Your account does not have teacher access. Please contact the admin.
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
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
                    style={[styles.dateChip, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}
                  >
                    <Text style={{ color: active ? '#FFF' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{DAY_LABELS[d.getDay()]}</Text>
                    <Text style={{ color: active ? '#FFF' : colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.heading, { color: colors.textPrimary }]}>Pick start times</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Each slot is {duration} minutes. Times are in India time (IST).
            </Text>
            <View style={styles.timeWrap}>
              {[...START_TIMES, ...customTimes].map((t) => {
                const disabled = isPast(t) || overlapsExisting(t);
                const active = picked.has(t);
                return (
                  <TouchableOpacity
                    key={t}
                    disabled={disabled}
                    onPress={() => toggle(t)}
                    style={[
                      styles.timeChip,
                      { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border },
                      disabled && { opacity: 0.35 },
                    ]}
                  >
                    <Text style={{ color: active ? '#FFF' : colors.textPrimary, fontSize: 12.5, fontWeight: '700' }}>{label(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.heading, { color: colors.textPrimary, marginTop: 18 }]}>Custom time (24-hour)</Text>
            <View style={styles.customRow}>
              <TextInput
                value={customHour}
                onChangeText={(v) => setCustomHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="HH"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
                style={[styles.customInput, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>:</Text>
              <TextInput
                value={customMin}
                onChangeText={(v) => setCustomMin(v.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="MM"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
                style={[styles.customInput, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]}
              />
              <TouchableOpacity style={[styles.customBtn, { backgroundColor: accent }]} onPress={addCustomTime} activeOpacity={0.85}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Add time</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 6 }]}>
              Example: 17 : 15 gives a slot starting at 17:15.
            </Text>

            <Text style={[styles.heading, { color: colors.textPrimary, marginTop: 22 }]}>Slots on this date</Text>
            {loadingSlots ? (
              <ActivityIndicator color={accent} style={{ marginTop: 10 }} />
            ) : daySlots.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>No slots have been added for this date yet.</Text>
            ) : (
              daySlots.map((s) => (
                <View key={s.id} style={[styles.slotRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotTime, { color: colors.textPrimary }]}>
                      {label(s.startTime)} - {label(s.endTime)}
                    </Text>
                    <Text style={{ color: s.isBooked ? '#D97706' : '#16A34A', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                      {s.isBooked ? 'Booked' : 'Open'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteSlot(s)} hitSlop={10} disabled={s.isBooked} style={s.isBooked && { opacity: 0.3 }}>
                    <Trash2 color="#DC2626" size={20} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.bgLight, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: accent }, (picked.size === 0 || saving) && { opacity: 0.45 }]}
              disabled={picked.size === 0 || saving}
              onPress={addSlots}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.addBtnText}>{picked.size > 0 ? `Add ${picked.size} slot${picked.size > 1 ? 's' : ''}` : 'Pick times to add slots'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
  heading: { fontSize: 17, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  hint: { fontSize: 12.5, marginBottom: 8 },
  dateChip: { width: 64, paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 12 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: { width: 64, borderWidth: 1, borderRadius: 12, paddingVertical: 10, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  customBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, marginLeft: 6 },
  slotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  slotTime: { fontSize: 15, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  addBtn: { borderRadius: 26, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});