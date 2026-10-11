import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCallSession } from '../home/screens/CallSessionProvider';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import {
  getAudioSessionsForTeacher,
  getMyAudioBookingIds,
  bookAudioSession,
  cancelAudioBooking,
  type AudioSession,
} from './sessionService';
import { getMySubscriptions } from '../payments/paymentService';
import type { ProgramAccess } from '../payments/paymentTypes';
import { launchAudioRoom } from './audioRoomLauncher';

// Student: group audio classes of the teacher linked to the student's Audio plan.
// Book a seat, cancel a seat, and join when the class is about to start.

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};
const startMs = (s: AudioSession) => new Date(`${s.date}T${s.startTime}:00`).getTime();
const endMs = (s: AudioSession) => new Date(`${s.date}T${s.endTime}:00`).getTime();
const dateLabel = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function AudioSessionsScreen() {
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
  const [sub, setSub] = useState<ProgramAccess | null>(null);
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const subs = await getMySubscriptions();
      setSub(subs.audio);
      if (subs.audio.active && subs.audio.teacherId) {
        const list = await getAudioSessionsForTeacher(subs.audio.teacherId);
        setSessions(list);
        setBooked(await getMyAudioBookingIds(list.map((x) => x.id)));
      }
    } catch (e) {
      console.error('AudioSessionsScreen: load error', e);
      Alert.alert('Error', 'Could not load the classes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const run = async (id: string, fn: () => Promise<any>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const canJoin = (s: AudioSession) => {
    const now = Date.now();
    return now >= startMs(s) - 15 * 60000 && now <= endMs(s) + 30 * 60000;
  };
  const canCancel = (s: AudioSession) => startMs(s) - Date.now() >= 15 * 60000;

  const renderBody = () => {
    if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 40 }} />;

    if (!sub?.active) {
      return (
        <View style={{ alignItems: 'center', marginTop: 40, gap: 16, paddingHorizontal: 24 }}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {sub?.reason === 'expired'
              ? 'Your Audio plan has expired. Renew it to join group classes.'
              : 'You need an active Audio plan to join group classes.'}
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() => navigation.replace('ProgramFlowScreen', { mode: 'audio' })}
          >
            <Text style={styles.primaryBtnText}>Choose your plan</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={[styles.planCard, { backgroundColor: accent + '14', borderColor: accent + '55' }]}>
          <Text style={[styles.planTitle, { color: colors.textPrimary }]}>{sub.planName}</Text>
          <Text style={[styles.planSub, { color: colors.textSecondary }]}>
            Teacher: <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{sub.teacherName}</Text> · Valid till{' '}
            {dateLabel(sub.expiresAt)}
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>Upcoming group classes</Text>
        {sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {sub.teacherName} has not scheduled any group class yet. Please check back soon.
          </Text>
        ) : (
          sessions.map((s) => {
            const isBooked = booked.has(s.id);
            const full = s.bookedCount >= s.maxParticipants;
            const busy = busyId === s.id;
            return (
              <View key={s.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.cTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                <Text style={[styles.cMeta, { color: accent }]}>
                  📅 {s.date}, {timeLabel(s.startTime)} - {timeLabel(s.endTime)}
                </Text>
                {!!s.description && <Text style={[styles.cDesc, { color: colors.textSecondary }]}>{s.description}</Text>}
                <Text style={[styles.cDesc, { color: colors.textSecondary }]}>
                  {s.bookedCount} / {s.maxParticipants} seats booked
                </Text>

                <View style={styles.actions}>
                  {isBooked ? (
                    <>
                      <TouchableOpacity
                        style={[styles.btn, { backgroundColor: canJoin(s) ? accent : accent + '33', flex: 1 }]}
                        disabled={!canJoin(s) || busy}
                        onPress={() => launchAudioRoom(startCall, s).catch((e) => Alert.alert('Cannot Join', e?.message || 'Please try again.'))}
                      >
                        <Text style={{ color: canJoin(s) ? '#FFF' : accent, fontWeight: '800' }}>
                          {canJoin(s) ? 'Join Now' : 'Booked'}
                        </Text>
                      </TouchableOpacity>
                      {canCancel(s) && (
                        <TouchableOpacity
                          style={[styles.btn, { borderColor: '#DC2626', borderWidth: 1.5 }]}
                          disabled={busy}
                          onPress={() =>
                            Alert.alert('Cancel your seat?', 'Your seat will be released for other students.', [
                              { text: 'Keep it', style: 'cancel' },
                              { text: 'Cancel seat', style: 'destructive', onPress: () => run(s.id, () => cancelAudioBooking(s.id)) },
                            ])
                          }
                        >
                          <Text style={{ color: '#DC2626', fontWeight: '800' }}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: accent, flex: 1 }, (full || busy) && { opacity: 0.45 }]}
                      disabled={full || busy}
                      onPress={() => run(s.id, () => bookAudioSession(s.id))}
                    >
                      {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>{full ? 'Class is full' : 'Book my seat'}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Audio Classes</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderBody()}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  primaryBtn: { borderRadius: 26, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  planCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4 },
  planTitle: { fontSize: 16, fontWeight: '800' },
  planSub: { fontSize: 13 },
  heading: { fontSize: 17, fontWeight: '800', marginTop: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 24, lineHeight: 20, paddingHorizontal: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cTitle: { fontSize: 16, fontWeight: '800' },
  cMeta: { fontSize: 13, fontWeight: '700' },
  cDesc: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { borderRadius: 22, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
});