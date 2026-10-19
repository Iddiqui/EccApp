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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { ChevronLeft, Trash2, Pencil } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { checkIsAdmin, getDemoConfig, type DemoConfig } from '../sessions/sessionService';

// ─────────────────────────────────────────────────────────────────────────
// Admin Panel (admins only: the email must be in the `admins` collection).
//   Teachers : add a teacher email (this is what gives teacher access),
//              choose Video / Audio, activate / deactivate, edit, delete
//   Plans    : change the PRICE of every Video / Audio plan and switch plans on/off.
//              Sessions, duration and validity are fixed and shown read-only.
//   Demo     : demo class price (0 = free) and on/off
//   Setup    : one-click "create default plans"
// Every write goes through a Cloud Function that re-checks the admin on the server.
// ─────────────────────────────────────────────────────────────────────────

type Tab = 'teachers' | 'plans' | 'demo';

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  modes: string[];
  isActive: boolean;
}

interface PlanRow {
  id: string;
  mode: 'video' | 'audio';
  durationMonths: number;
  durationLabel: string;
  sessions: number | null;
  sessionMins: number | null;
  price: number;
  isActive: boolean;
}

const call = async (fn: string, payload?: any) => {
  const res = await functions().httpsCallable(fn)(payload);
  return res.data as any;
};

export default function AdminPanelScreen() {
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

  const [allowed, setAllowed] = useState<boolean | null>(null);
  // Shown on the 'admins only' screen so it is clear WHY access was refused
  const [denyInfo, setDenyInfo] = useState<string>('');
  const [tab, setTab] = useState<Tab>('teachers');

  // ── Teachers ──
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tName, setTName] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tVideo, setTVideo] = useState(true);
  const [tAudio, setTAudio] = useState(true);
  const [busy, setBusy] = useState(false);

  // ── Plans ──
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  // ── Demo ──
  const [demo, setDemo] = useState<DemoConfig | null>(null);
  const [demoPrice, setDemoPrice] = useState('');
  const [demoActive, setDemoActive] = useState(true);

  const loadTeachers = useCallback(async () => {
    const snap = await firestore().collection('session_teachers').get();
    setTeachers(
      snap.docs
        .map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            name: x.name || '',
            email: x.email || '',
            modes: Array.isArray(x.modes) ? x.modes : ['video', 'audio'],
            isActive: x.isActive !== false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, []);

  const loadPlans = useCallback(async () => {
    const snap = await firestore().collection('subscriptionPlans').get();
    const rows = snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        mode: x.mode,
        durationMonths: x.durationMonths,
        durationLabel: x.durationLabel,
        sessions: x.sessions ?? null,
        sessionMins: x.sessionMins ?? null,
        price: x.price ?? 0,
        isActive: x.isActive !== false,
      } as PlanRow;
    });
    rows.sort((a, b) =>
      a.mode !== b.mode
        ? a.mode.localeCompare(b.mode)
        : a.durationMonths !== b.durationMonths
        ? a.durationMonths - b.durationMonths
        : (a.sessions || 0) - (b.sessions || 0)
    );
    setPlans(rows);
    const draft: Record<string, string> = {};
    rows.forEach((r) => (draft[r.id] = r.price ? String(r.price) : ''));
    setPriceDraft(draft);
  }, []);

  const loadDemo = useCallback(async () => {
    const cfg = await getDemoConfig();
    setDemo(cfg);
    setDemoPrice(String(cfg.price));
    setDemoActive(cfg.isActive);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadTeachers(), loadPlans(), loadDemo()]);
    } catch (e) {
      console.error('AdminPanelScreen: load error', e);
      Alert.alert('Error', 'Could not load the admin data. Please try again.');
    }
  }, [loadTeachers, loadPlans, loadDemo]);

  useEffect(() => {
    // Shows only WHY access was refused. The list of admin emails is not shown to the user.
    const explainDenied = (reason: string) => {
      const email = auth().currentUser?.email || '(no email)';
      setDenyInfo(`Signed in as: ${email}\n${reason}`);
    };
    checkIsAdmin()
      .then((ok) => {
        setAllowed(ok);
        if (ok) loadAll();
        else explainDenied('Your email was not found in the admins list.');
      })
      .catch((e: any) => {
        setAllowed(false);
        explainDenied(`Admin check failed: ${e?.code || ''} ${e?.message || e}`);
      });
  }, [loadAll]);

  const run = async (fn: () => Promise<any>, okMessage?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMessage) Alert.alert('Done', okMessage);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ───────────── Teacher actions ─────────────
  const resetTeacherForm = () => {
    setEditingId(null);
    setTName('');
    setTEmail('');
    setTVideo(true);
    setTAudio(true);
  };

  const saveTeacher = () =>
    run(async () => {
      const modes = [tVideo && 'video', tAudio && 'audio'].filter(Boolean);
      await call('adminUpsertTeacher', {
        teacherId: editingId || undefined,
        name: tName,
        email: tEmail,
        modes,
        isActive: true,
      });
      resetTeacherForm();
      await loadTeachers();
    }, editingId ? 'Teacher updated.' : 'Teacher added. They can now log in with this email and get teacher access.');

  const startEdit = (t: TeacherRow) => {
    setEditingId(t.id);
    setTName(t.name);
    setTEmail(t.email);
    setTVideo(t.modes.includes('video'));
    setTAudio(t.modes.includes('audio'));
  };

  const toggleTeacher = (t: TeacherRow, value: boolean) =>
    run(async () => {
      await call('adminSetTeacherActive', { teacherId: t.id, isActive: value });
      await loadTeachers();
    });

  const deleteTeacher = (t: TeacherRow) =>
    Alert.alert(
      'Delete teacher?',
      `${t.name} will lose teacher access and all their slots will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await call('adminDeleteTeacher', { teacherId: t.id });
              await loadTeachers();
            }, 'Teacher deleted.'),
        },
      ]
    );

  // ───────────── Plan actions ─────────────
  const savePlan = (p: PlanRow, nextActive: boolean, nextPrice?: number) =>
    run(async () => {
      const payload: any = { planId: p.id, isActive: nextActive };
      if (nextPrice !== undefined) payload.price = nextPrice;
      await call('adminUpdatePlanPrice', payload);
      await loadPlans();
    });

  const savePlanPrice = (p: PlanRow) => {
    const price = Number(priceDraft[p.id]);
    if (!Number.isInteger(price) || price < 1) {
      Alert.alert('Invalid Price', 'Enter the price in whole rupees (at least ₹1).');
      return;
    }
    // Saving a price also switches the plan on, so it shows to students right away.
    savePlan(p, true, price).then(() => undefined);
  };

  const seedDefaults = () =>
    run(async () => {
      await call('seedProgramPlans');
      await loadPlans();
    }, 'Default plans are up to date.');

  // ───────────── Demo actions ─────────────
  const saveDemo = () => {
    const price = Number(demoPrice);
    if (!Number.isInteger(price) || price < 0 || price > 100000) {
      Alert.alert('Invalid Price', 'Enter a whole number of rupees (0 means free).');
      return;
    }
    run(async () => {
      await call('adminSetDemoConfig', { price, isActive: demoActive });
      await loadDemo();
    }, 'Demo class settings saved.');
  };

  const grouped = useMemo(
    () => ({
      video: plans.filter((p) => p.mode === 'video'),
      audio: plans.filter((p) => p.mode === 'audio'),
    }),
    [plans]
  );

  // ───────────── UI ─────────────
  const card = { backgroundColor: colors.bgCard, borderColor: colors.border };
  const input = [styles.input, { backgroundColor: colors.bgLight, borderColor: colors.border, color: colors.textPrimary }];

  if (allowed === null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight, justifyContent: 'center' }]}>
        <ActivityIndicator color={accent} />
      </SafeAreaView>
    );
  }
  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight, justifyContent: 'center', padding: 30 }]}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14 }}>
          This section is for admins only.
        </Text>
        {!!denyInfo && (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12, marginTop: 16, lineHeight: 18 }}>
            {denyInfo}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  const renderTeachers = () => (
    <>
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {editingId ? 'Edit teacher' : 'Add a teacher'}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Only emails added here get teacher access. The teacher logs in with this same email.
        </Text>
        <TextInput
          value={tName}
          onChangeText={setTName}
          placeholder="Teacher name"
          placeholderTextColor={colors.textSecondary}
          style={input}
        />
        <TextInput
          value={tEmail}
          onChangeText={setTEmail}
          placeholder="Teacher email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={input}
        />
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Video Mode (1-to-1)</Text>
          <Switch value={tVideo} onValueChange={setTVideo} trackColor={{ true: accent }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Audio Mode (group classes)</Text>
          <Switch value={tAudio} onValueChange={setTAudio} trackColor={{ true: accent }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          {editingId && (
            <TouchableOpacity style={[styles.btn, { borderColor: accent, borderWidth: 1.5, flex: 1 }]} onPress={resetTeacherForm}>
              <Text style={{ color: accent, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: accent, flex: 2 }, (busy || !tName.trim() || !tEmail.trim() || (!tVideo && !tAudio)) && { opacity: 0.45 }]}
            disabled={busy || !tName.trim() || !tEmail.trim() || (!tVideo && !tAudio)}
            onPress={saveTeacher}
          >
            <Text style={styles.btnText}>{editingId ? 'Save changes' : 'Add teacher'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Teachers ({teachers.length})</Text>
      {teachers.map((t) => (
        <View key={t.id} style={[styles.card, card]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t.name || '(no name)'}</Text>
              <Text style={[styles.hint, { color: t.email ? colors.textSecondary : '#DC2626' }]}>
                {t.email || 'No email: this teacher cannot be booked'}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t.modes.map((m) => (m === 'video' ? 'Video' : 'Audio')).join(' + ') || 'No mode'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => startEdit(t)} hitSlop={10}>
              <Pencil color={colors.textSecondary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTeacher(t)} hitSlop={10}>
              <Trash2 color="#DC2626" size={18} />
            </TouchableOpacity>
          </View>
          <View style={[styles.switchRow, { marginTop: 8 }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t.isActive ? 'Active (teacher access on)' : 'Inactive (access off)'}
            </Text>
            <Switch value={t.isActive} onValueChange={(v) => toggleTeacher(t, v)} trackColor={{ true: accent }} />
          </View>
        </View>
      ))}
    </>
  );

  const renderPlanGroup = (title: string, list: PlanRow[]) => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {list.map((p, idx) => (
        <React.Fragment key={p.id}>
        {(idx === 0 || list[idx - 1].durationMonths !== p.durationMonths) && (
          <Text style={[styles.hint, { color: accent, fontWeight: '800', marginTop: idx === 0 ? 0 : 14, fontSize: 13 }]}>
            {p.durationLabel}
          </Text>
        )}
        <View style={[styles.card, card]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {p.mode === 'video' ? `${p.sessions} sessions` : p.durationLabel}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {p.mode === 'video'
                  ? `${p.durationLabel} · ${p.sessionMins} min each · current ₹${p.price}`
                  : 'Group classes (fixed)'}
              </Text>
            </View>
            <Switch value={p.isActive} onValueChange={(v) => savePlan(p, v)} trackColor={{ true: accent }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <Text style={[styles.rupee, { color: colors.textPrimary }]}>₹</Text>
            <TextInput
              value={priceDraft[p.id] ?? ''}
              onChangeText={(t) => setPriceDraft((d) => ({ ...d, [p.id]: t.replace(/[^0-9]/g, '') }))}
              placeholder="Set price"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[...input, { flex: 1, marginTop: 0 }]}
              maxLength={7}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: accent, paddingHorizontal: 18 }, busy && { opacity: 0.45 }]}
              disabled={busy}
              onPress={() => savePlanPrice(p)}
            >
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
          {!p.isActive && (
            <Text style={[styles.hint, { color: '#D97706', marginTop: 6 }]}>
              Hidden from students ("Coming soon"). Enter a price and press Save to switch it on.
            </Text>
          )}
        </View>
        </React.Fragment>
      ))}
    </>
  );

  const renderPlans = () => (
    <>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        You can change the price and turn a plan on or off. Sessions and validity are fixed. A new price applies to new
        purchases only; plans already bought are not affected.
      </Text>
      {renderPlanGroup('Video Mode (1-to-1)', grouped.video)}
      {renderPlanGroup('Audio Mode (group classes)', grouped.audio)}
      <TouchableOpacity style={[styles.btn, { borderColor: accent, borderWidth: 1.5, marginTop: 16 }, busy && { opacity: 0.45 }]} disabled={busy} onPress={seedDefaults}>
        <Text style={{ color: accent, fontWeight: '800' }}>Create / refresh default plans</Text>
      </TouchableOpacity>
    </>
  );

  const renderDemo = () => (
    <View style={[styles.card, card]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Demo class</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Every student can book one demo class. Set the price in rupees (0 means free).
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <Text style={[styles.rupee, { color: colors.textPrimary }]}>₹</Text>
        <TextInput
          value={demoPrice}
          onChangeText={(t) => setDemoPrice(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="99"
          placeholderTextColor={colors.textSecondary}
          style={[...input, { flex: 1, marginTop: 0 }]}
          maxLength={6}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Demo classes available</Text>
        <Switch value={demoActive} onValueChange={setDemoActive} trackColor={{ true: accent }} />
      </View>
      <TouchableOpacity style={[styles.btn, { backgroundColor: accent, marginTop: 8 }, busy && { opacity: 0.45 }]} disabled={busy} onPress={saveDemo}>
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>
      {demo && (
        <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 8 }]}>
          Current: {demo.isActive ? 'on' : 'off'}, {demo.price === 0 ? 'free' : `₹${demo.price}`}
        </Text>
      )}
    </View>
  );

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Admin Panel</Text>
      </View>

      <View style={styles.tabs}>
        {(['teachers', 'plans', 'demo'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}
            >
              <Text style={{ color: active ? '#FFF' : colors.textSecondary, fontWeight: '800', fontSize: 13 }}>
                {t === 'teachers' ? 'Teachers' : t === 'plans' ? 'Plan prices' : 'Demo class'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'teachers' && renderTeachers()}
        {tab === 'plans' && renderPlans()}
        {tab === 'demo' && renderDemo()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  cardTitle: { fontSize: 15.5, fontWeight: '800' },
  hint: { fontSize: 12.5, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  label: { fontSize: 13.5, fontWeight: '600', flex: 1 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  rupee: { fontSize: 18, fontWeight: '800' },
});