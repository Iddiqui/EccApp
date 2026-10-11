import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Star } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getSessionsToReview, submitReview } from './reviewService';
import type { Booking } from './sessionTypes';

// "Rate your sessions": finished sessions that the student has not rated yet.
export default function RateSessionsScreen() {
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
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [target, setTarget] = useState<Booking | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await getSessionsToReview());
    } catch (e) {
      console.error('RateSessionsScreen: load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRate = (b: Booking) => {
    setTarget(b);
    setStars(0);
    setComment('');
  };

  const send = async () => {
    if (!target || sending) return;
    if (stars < 1) {
      Alert.alert('Choose a Rating', 'Please tap the stars to rate this session.');
      return;
    }
    setSending(true);
    try {
      await submitReview(target.id, stars, comment.trim());
      setTarget(null);
      Alert.alert('Thank You!', 'Your review has been submitted.');
      await load();
    } catch (e: any) {
      Alert.alert('Could Not Submit', e?.message || 'Please try again.');
      // Already rated? Refresh so it leaves the list.
      load();
    } finally {
      setSending(false);
    }
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Rate your sessions</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {sessions.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              Nothing to rate right now. Finished sessions will show up here.
            </Text>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.textPrimary }]}>{s.teacherName}</Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {s.date} · {s.startTime} - {s.endTime}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.rateBtn, { backgroundColor: accent }]} onPress={() => openRate(s)}>
                  <Star color="#FFF" size={14} fill="#FFF" />
                  <Text style={styles.rateText}>Rate</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => !sending && setTarget(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              How was your session with {target?.teacherName}?
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Star color="#F59E0B" size={38} fill={n <= stars ? '#F59E0B' : 'transparent'} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Write a short review (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={300}
              style={[
                styles.input,
                { backgroundColor: colors.bgLight, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.bgLight, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setTarget(null)}
                disabled={sending}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: accent, flex: 1.4 }, sending && { opacity: 0.6 }]}
                onPress={send}
                disabled={sending}
              >
                {sending ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Submit review</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  name: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12.5, marginTop: 3 },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  rateText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 22, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 18 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, height: 90, textAlignVertical: 'top', fontSize: 14 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});