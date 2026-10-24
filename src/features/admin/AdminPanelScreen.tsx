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
//   Word Zip : add / edit / delete / switch off the Word Zip puzzles (word_zip_puzzles)
//   Rooms    : active public classes, with "End Class for Everyone"
//   Setup    : one-click "create default plans"
// Every write goes through a Cloud Function that re-checks the admin on the server.
// ─────────────────────────────────────────────────────────────────────────

type Tab = 'teachers' | 'plans' | 'demo' | 'rooms' | 'zip';

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

interface ZipRow {
  id: string;
  title: string;
  theme: string;
  grid: string[];
  words: { word: string; meaning: string }[];
  active: boolean;
  order: number;
}

// "WORD - meaning" per line (the meaning is optional)
const parseZipWords = (text: string): { word: string; meaning: string }[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([A-Za-z]{2,16})\s*(?:[-–—:|]\s*(.*))?$/);
      return m ? { word: m[1].toUpperCase(), meaning: (m[2] || '').trim() } : null;
    })
    .filter(Boolean) as { word: string; meaning: string }[];

// Can the word be made by touching neighbouring letters (also diagonally) without using a letter twice?
const canTraceWord = (grid: string[], word: string): boolean => {
  const cells = grid.map((r) => r.split(''));
  const used = cells.map((r) => r.map(() => false));
  const go = (r: number, c: number, i: number): boolean => {
    if (r < 0 || c < 0 || r > 3 || c > 3 || used[r][c] || cells[r][c] !== word[i]) return false;
    if (i === word.length - 1) return true;
    used[r][c] = true;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dr || dc) && go(r + dr, c + dc, i + 1)) {
          used[r][c] = false;
          return true;
        }
      }
    }
    used[r][c] = false;
    return false;
  };
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (go(r, c, 0)) return true;
  return false;
};

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

  // ── Word Zip puzzles ──
  const [zipList, setZipList] = useState<ZipRow[]>([]);
  const [zipEditId, setZipEditId] = useState<string | null>(null);
  const [zTitle, setZTitle] = useState('');
  const [zTheme, setZTheme] = useState('');
  const [zRows, setZRows] = useState<string[]>(['', '', '', '']);
  const [zWords, setZWords] = useState('');
  const [zActive, setZActive] = useState(true);

  // ── Active public rooms ──
  const [pubRooms, setPubRooms] = useState<{ id: string; title: string; hostName: string; hostLeft: boolean }[]>([]);

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

  // Live list of Word Zip puzzles
  useEffect(() => {
    if (!allowed) return;
    const unsub = firestore()
      .collection('word_zip_puzzles')
      .onSnapshot(
        (snap) => {
          const rows: ZipRow[] = [];
          snap?.docs?.forEach((d) => {
            const x: any = d.data() || {};
            rows.push({
              id: d.id,
              title: x.title || 'Word Zip',
              theme: x.theme || '',
              grid: Array.isArray(x.grid) ? x.grid.map((r: any) => String(r || '')) : ['', '', '', ''],
              words: Array.isArray(x.words) ? x.words : [],
              active: x.active !== false,
              order: Number(x.order) || 0,
            });
          });
          rows.sort((a, b) => a.order - b.order);
          setZipList(rows);
        },
        (e) => console.log('Word Zip list error:', e)
      );
    return () => unsub();
  }, [allowed]);

  const resetZipForm = () => {
    setZipEditId(null);
    setZTitle('');
    setZTheme('');
    setZRows(['', '', '', '']);
    setZWords('');
    setZActive(true);
  };

  const editZip = (z: ZipRow) => {
    setZipEditId(z.id);
    setZTitle(z.title);
    setZTheme(z.theme);
    setZRows([0, 1, 2, 3].map((i) => z.grid[i] || ''));
    setZWords(z.words.map((w) => (w.meaning ? `${w.word} - ${w.meaning}` : w.word)).join('\n'));
    setZActive(z.active);
  };

  const doSaveZip = (payload: any) =>
    run(async () => {
      const col = firestore().collection('word_zip_puzzles');
      if (zipEditId) {
        await col.doc(zipEditId).set({ ...payload, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
      } else {
        await col.add({ ...payload, order: Date.now(), createdAt: firestore.FieldValue.serverTimestamp() });
      }
      resetZipForm();
    }, zipEditId ? 'Puzzle updated.' : 'Puzzle added. Students see it in the Word Zip game.');

  const saveZip = () => {
    const rows = zRows.map((r) => r.trim().toUpperCase());
    if (rows.some((r) => !/^[A-Z]{4}$/.test(r))) {
      return Alert.alert('Grid', 'Each of the 4 rows needs exactly 4 letters (A-Z).');
    }
    const words = parseZipWords(zWords);
    if (words.length === 0) return Alert.alert('Words', 'Add at least one word. One per line, like:  FLUENT - able to speak smoothly');
    const unique = Array.from(new Map(words.map((w) => [w.word, w])).values());
    const bad = unique.filter((w) => !canTraceWord(rows, w.word)).map((w) => w.word);
    const payload = {
      title: zTitle.trim() || 'Word Zip',
      theme: zTheme.trim() || zTitle.trim() || 'Word Zip',
      grid: rows,
      words: unique,
      active: zActive,
    };
    if (bad.length > 0) {
      Alert.alert(
        'Check these words',
        `${bad.join(', ')} cannot be made from touching neighbouring letters in this grid. Students may not be able to find them. Save anyway?`,
        [
          { text: 'Fix it', style: 'cancel' },
          { text: 'Save anyway', onPress: () => doSaveZip(payload) },
        ]
      );
      return;
    }
    doSaveZip(payload);
  };

  const deleteZip = (z: ZipRow) => {
    Alert.alert('Delete puzzle', `Delete "${z.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await firestore().collection('word_zip_puzzles').doc(z.id).delete();
            if (zipEditId === z.id) resetZipForm();
          }),
      },
    ]);
  };

  const toggleZip = (z: ZipRow, v: boolean) =>
    run(async () => {
      await firestore().collection('word_zip_puzzles').doc(z.id).update({ active: v });
    });

  // Live list of public rooms (updates by itself)
  useEffect(() => {
    if (!allowed) return;
    const unsub = firestore()
      .collection('voice_rooms')
      .onSnapshot(
        (snap) => {
          const rows: any[] = [];
          snap?.docs?.forEach((d) => {
            const x: any = d.data() || {};
            if (x.type && x.type !== 'public') return;
            rows.push({ id: d.id, title: x.title || 'Room', hostName: x.hostName || 'User', hostLeft: !!x.hostLeft });
          });
          setPubRooms(rows);
        },
        () => {}
      );
    return () => unsub();
  }, [allowed]);

  const endClassForEveryone = (r: { id: string; title: string }) => {
    Alert.alert(
      'End class for everyone?',
      `"${r.title}" will be closed and everybody inside will be disconnected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End class',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              const ref = firestore().collection('voice_rooms').doc(r.id);
              // 1) flag: every connected phone disconnects and goes back to the list
              await ref.update({ endedByAdmin: true });
              // 2) give the phones a moment to react, then remove the room
              await new Promise((res) => setTimeout(res, 3000));
              await ref.delete();
            }, 'The class was ended for everyone.'),
        },
      ]
    );
  };

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
    const explainDenied = async (reason: string) => {
      const email = auth().currentUser?.email || '(no email)';
      let listInfo = '';
      try {
        const snap = await firestore().collection('admins').get();
        const emails = snap.docs.map((d) => String((d.data() as any).email || '(no email field)'));
        listInfo = `admins list (${emails.length}): ${emails.join(', ') || 'empty'}`;
      } catch (e: any) {
        listInfo = `Could not read the admins list: ${e?.code || ''} ${e?.message || e}`;
      }
      setDenyInfo(`Signed in as: ${email}\n${reason}\n${listInfo}`);
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

  const renderZip = () => (
    <>
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{zipEditId ? 'Edit Word Zip puzzle' : 'Add a Word Zip puzzle'}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          The grid is 4 x 4 letters. Students join neighbouring letters to make the words. Puzzles are shown to students in order;
          if you add none, the built-in puzzles are used.
        </Text>
        <TextInput value={zTitle} onChangeText={setZTitle} placeholder="Title (e.g. English Fluency)" placeholderTextColor={colors.textSecondary} style={input} />
        <TextInput value={zTheme} onChangeText={setZTheme} placeholder="Theme line (optional)" placeholderTextColor={colors.textSecondary} style={input} />
        <Text style={[styles.label, { color: colors.textPrimary, marginTop: 10 }]}>Grid (4 letters in each row)</Text>
        {[0, 1, 2, 3].map((i) => (
          <TextInput
            key={i}
            value={zRows[i]}
            onChangeText={(t) => setZRows((prev) => prev.map((r, j) => (j === i ? t.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() : r)))}
            placeholder={`Row ${i + 1}  (4 letters)`}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            maxLength={4}
            style={[...input, { letterSpacing: 6, fontWeight: '800' }]}
          />
        ))}
        <Text style={[styles.label, { color: colors.textPrimary, marginTop: 10 }]}>Words (one per line:  WORD - meaning)</Text>
        <TextInput
          value={zWords}
          onChangeText={setZWords}
          placeholder={'FLUENT - able to speak smoothly\nTALK - to speak with someone'}
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[...input, { minHeight: 110, textAlignVertical: 'top' }]}
        />
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Active (visible to students)</Text>
          <Switch value={zActive} onValueChange={setZActive} trackColor={{ true: accent }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          {zipEditId && (
            <TouchableOpacity style={[styles.btn, { borderColor: accent, borderWidth: 1.5, flex: 1 }]} onPress={resetZipForm}>
              <Text style={{ color: accent, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: accent, flex: 2 }, busy && { opacity: 0.45 }]} disabled={busy} onPress={saveZip}>
            <Text style={styles.btnText}>{zipEditId ? 'Save changes' : 'Add puzzle'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Puzzles ({zipList.length})</Text>
      {zipList.length === 0 && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>No puzzle added yet. Students currently see the built-in puzzles.</Text>
      )}
      {zipList.map((z) => (
        <View key={z.id} style={[styles.card, card]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{z.title}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={1}>
                {z.grid.join('  ')}   •   {z.words.length} words
              </Text>
              <Text style={[styles.hint, { color: z.active ? '#10B981' : '#EF4444', fontWeight: '800' }]}>{z.active ? 'Active' : 'Hidden'}</Text>
            </View>
            <Switch value={z.active} onValueChange={(v) => toggleZip(z, v)} trackColor={{ true: accent }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.btn, { borderColor: accent, borderWidth: 1.5, flex: 1 }]} onPress={() => editZip(z)}>
              <Text style={{ color: accent, fontWeight: '800' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#EF4444', flex: 1 }]} onPress={() => deleteZip(z)}>
              <Text style={styles.btnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  );

  const renderRooms = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active public classes ({pubRooms.length})</Text>
      {pubRooms.length === 0 && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>No public class is active right now.</Text>
      )}
      {pubRooms.map((r) => (
        <View key={r.id} style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{r.title}</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Hosted by {r.hostName}{r.hostLeft ? '  •  Host left' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#EF4444', marginTop: 8 }, busy && { opacity: 0.45 }]}
            disabled={busy}
            onPress={() => endClassForEveryone(r)}
          >
            <Text style={styles.btnText}>End Class for Everyone</Text>
          </TouchableOpacity>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 56 }} contentContainerStyle={[styles.tabs, { alignItems: 'center' }]}>
        {(['teachers', 'plans', 'demo', 'zip', 'rooms'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, { backgroundColor: active ? accent : colors.bgCard, borderColor: active ? accent : colors.border }]}
            >
              <Text style={{ color: active ? '#FFF' : colors.textSecondary, fontWeight: '800', fontSize: 13 }}>
                {t === 'teachers' ? 'Teachers' : t === 'plans' ? 'Plan prices' : t === 'demo' ? 'Demo class' : t === 'zip' ? 'Word Zip' : 'Rooms'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'teachers' && renderTeachers()}
        {tab === 'plans' && renderPlans()}
        {tab === 'demo' && renderDemo()}
        {tab === 'zip' && renderZip()}
        {tab === 'rooms' && renderRooms()}
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
  tab: { height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
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