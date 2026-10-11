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
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCallSession } from '../home/screens/CallSessionProvider';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import {
  getMyTeacherProfile,
  getAudioSessionsForTeacher,
  getAudioAttendees,
  createAudioSession,
  cancelAudioSession,
  localDateKey,
  type AudioSession,
} from './sessionService';
import { launchAudioRoom } from './audioRoomLauncher';

// Teacher: create and manage GROUP audio classes. Students with an Audio plan linked to this
// teacher can book a seat; everyone joins the same room (`audio_<sessionId>`).

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DURATIONS = [30, 45, 60, 90];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};
const START_TIMES: string[] = [];
for (let m = 6 * 60; m <= 22 * 60; m += 30) START_TIMES.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);

const startMs = (s: AudioSession) => new Date(`${s.date}T${s.startTime}:00`).getTime();
const endMs = (s: AudioSession) => new Date(`${s.date}T${s.endTime}:00`).getTime();

export default function TeacherAudioSessionsScreen() {
  const navigation = useNavigation<any>();
  const { startCall } = useCallSession();
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
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<{ id: string; studentName: string }[]>([]);

  // create form
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateKey, setDateKey] = useState(localDateKey());
  const [startTime, setStartTime] = useState('18:00');
  const [customH, setCustomH] = useState('');
  const [customM, setCustomM] = useState('');
  const applyCustomTime = () => {
    const h = parseInt(customH, 10);
    const m = parseInt(customM === '' ? '0' : customM, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Invalid time', 'Enter hour 0-23 and minutes 0-59 (24-hour format).');
      return;
    }
    setStartTime(`${pad(h)}:${pad(m)}`);
    setCustomH('');
    setCustomM('');
  };
  const [duration, setDuration] = useState(60);
  const [maxP, setMaxP] = useState('50');
  const [saving, setSaving] = useState(false);

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

  const load = useCallback(async () => {
    try {
      const t = await getMyTeacherProfile();
      setTeacher(t);
      if (t) setSessions(await getAudioSessionsForTeacher(t.id));
    } catch (e) {
      console.error('TeacherAudioSessionsScreen: load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAttendees = async (s: AudioSession) => {
    if (openId === s.id) {
      setOpenId(null);
      return;
    }
    setOpenId(s.id);
    setAttendees([]);
    try {
      setAttendees(await getAudioAttendees(s.id));
    } catch (e) {
      console.error('TeacherAudioSessionsScreen: attendees error', e);
    }
  };

  const create = async () => {
    if (saving) return;
    const max = Number(maxP);
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for the class.');
      return;
    }
    if (!Number.isInteger(max) || max < 1 || max > 200) {
      Alert.alert('Invalid Seats', 'Maximum participants must be between 1 and 200.');
      return;
    }
    setSaving(true);
    try {
      await createAudioSession({ title, description, date: dateKey, startTime, durationMins: duration, maxParticipants: max });
      setFormOpen(false);
      setTitle('');
      setDescription('');
      await load();
      Alert.alert('Class Created', 'Students with your Audio plan can now book a seat.');
    } catch (e: any) {
      Alert.alert('Could Not Create', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = (s: AudioSession) =>
    Alert.alert('Cancel this class?', 'Students who booked a seat will no longer be able to join.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel class',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAudioSession(s.id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not cancel the class.');
          }
        },
      },
    ]);

  const canStart = (s: AudioSession) => {
    const now = Date.now();
    return now >= startMs(s) - 15 * 60000 && now <= endMs(s) + 30 * 60000;
  };

  const input = [styles.input, { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary }];

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary, flex: 1 }]}>Group Audio Classes</Text>
        {!!teacher && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: accent }]} onPress={() => setFormOpen(true)}>
            <Plus color="#FFF" size={18} />
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : !teacher ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Your account does not have teacher access. Please contact the admin.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {sessions.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No upcoming group classes. Tap New to schedule one.
            </Text>
          )}
          {sessions.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.cTitle, { color: colors.textPrimary }]}>{s.title}</Text>
              <Text style={[styles.cMeta, { color: accent }]}>
                📅 {s.date}, {timeLabel(s.startTime)} - {timeLabel(s.endTime)}
              </Text>
              {!!s.description && <Text style={[styles.cDesc, { color: colors.textSecondary }]}>{s.description}</Text>}

              <TouchableOpacity onPress={() => toggleAttendees(s)}>
                <Text style={[styles.cDesc, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {s.bookedCount} / {s.maxParticipants} students booked  {openId === s.id ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {openId === s.id && (
                <View style={{ gap: 2 }}>
                  {attendees.length === 0 ? (
                    <Text style={[styles.cDesc, { color: colors.textSecondary }]}>No students yet.</Text>
                  ) : (
                    attendees.map((a) => (
                      <Text key={a.id} style={[styles.cDesc, { color: colors.textSecondary }]}>
                        • {a.studentName}
                      </Text>
                    ))
                  )}
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: canStart(s) ? accent : accent + '33', flex: 1 }]}
                  disabled={!canStart(s)}
                  onPress={() => launchAudioRoom(startCall, s).catch((e) => Alert.alert('Cannot Start', e?.message || 'Please try again.'))}
                >
                  <Text style={{ color: canStart(s) ? '#FFF' : accent, fontWeight: '800' }}>
                    {canStart(s) ? 'Start class' : 'Not started'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { borderColor: '#DC2626', borderWidth: 1.5 }]} onPress={() => cancel(s)}>
                  <Text style={{ color: '#DC2626', fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, flex: 1 }]}>New group class</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={12}>
              <X color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.textPrimary }]}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Speaking practice: daily life" placeholderTextColor={colors.textSecondary} style={input} maxLength={80} />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Description (optional)</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="What will students do in this class?" placeholderTextColor={colors.textSecondary} multiline maxLength={500} style={[...input, { height: 90, textAlignVertical: 'top' }]} />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d) => {
                const key = localDateKey(d);
                const active = key === dateKey;
                return (
                  <TouchableOpacity key={key} onPress={() => setDateKey(key)} style={[styles.dateChip, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}>
                    <Text style={{ color: active ? '#FFF' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{DAY_LABELS[d.getDay()]}</Text>
                    <Text style={{ color: active ? '#FFF' : colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Start time (India time)</Text>
            <View style={styles.wrap}>
              {START_TIMES.map((t) => {
                const active = t === startTime;
                return (
                  <TouchableOpacity key={t} onPress={() => setStartTime(t)} style={[styles.timeChip, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}>
                    <Text style={{ color: active ? '#FFF' : colors.textPrimary, fontSize: 12.5, fontWeight: '700' }}>{timeLabel(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 6 }}>
              Selected: {timeLabel(startTime)}. For another time, enter it in 24-hour format (e.g. 14 : 20).
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TextInput value={customH} onChangeText={(t) => setCustomH(t.replace(/[^0-9]/g, '').slice(0, 2))} placeholder="HH" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" maxLength={2} style={[...input, { width: 64, textAlign: 'center' }]} />
              <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>:</Text>
              <TextInput value={customM} onChangeText={(t) => setCustomM(t.replace(/[^0-9]/g, '').slice(0, 2))} placeholder="MM" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" maxLength={2} style={[...input, { width: 64, textAlign: 'center' }]} />
              <TouchableOpacity onPress={applyCustomTime} style={[styles.timeChip, { backgroundColor: accent, borderColor: accent }]}>
                <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700' }}>Set time</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Duration</Text>
            <View style={styles.wrap}>
              {DURATIONS.map((d) => {
                const active = d === duration;
                return (
                  <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[styles.timeChip, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}>
                    <Text style={{ color: active ? '#FFF' : colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{d} min</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Maximum students</Text>
            <TextInput value={maxP} onChangeText={(t) => setMaxP(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={input} maxLength={3} />
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: colors.bgLight, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]} disabled={saving} onPress={create}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Create class</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  scroll: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cTitle: { fontSize: 16, fontWeight: '800' },
  cMeta: { fontSize: 13, fontWeight: '700' },
  cDesc: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { borderRadius: 22, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13.5, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  dateChip: { width: 60, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 12 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});