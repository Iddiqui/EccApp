import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
} from 'react-native';
// 🎯 FIX: same Android status-bar overlap issue — RN's own SafeAreaView
// doesn't add a top inset on Android.
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import {
  ChevronLeft,
  User,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Check,
  Search,
  AlertTriangle,
  Mail,
  Pencil,
} from 'lucide-react-native';
import type { Teacher, TimeSlot } from './sessionTypes';

// ─────────────────────────────────────────────────────────────────────────
// Admin ke liye: kisi bhi teacher ke liye available 1-on-1 session slots
// create karna. Har slot Firestore me yahan save hota hai:
//   session_teachers/{teacherId}/slots/{slotId}
//     { teacherId, date: 'YYYY-MM-DD', startTime: 'HH:mm', endTime: 'HH:mm',
//       isBooked: false, createdAt }
//
// 🆕 EMAIL ADD/EDIT INLINE: pehle sirf ek warning dikhti thi agar teacher
// ka email missing hota tha (bookings tab fail hoti thi, kyunki
// createBooking Cloud Function teacher.email na hone par error deti hai).
// Ab admin isی screen se — bina Firebase Console khole — teacher ka email
// add ya edit kar sakta hai. Naya teacher "Quick Add" se banane par bhi
// email khaali hi banta hai, isi liye ye edit-inline feature production
// me zaroori hai (naye teachers add hote rahenge, koi bhi email bhool
// sakta hai).
// ─────────────────────────────────────────────────────────────────────────
const START_HOUR = 8; // 8:00 AM (first available start time)
const END_HOUR = 21; // 9:00 PM (last start time before this)

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMinutesToTime(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${pad(nh)}:${pad(nm)}`;
}

function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
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

function buildStartTimeOptions(durationMin: number) {
  const times: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (const m of [0, 30]) {
      if (h === END_HOUR && m === 30) continue;
      times.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return times;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function AdminSlotCreationScreen({ navigation }: any) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const nextDays = useMemo(() => buildNextDays(21), []);
  const [selectedDate, setSelectedDate] = useState<Date>(nextDays[0]);

  const [selectedStartTimes, setSelectedStartTimes] = useState<Set<string>>(new Set());

  const [existingSlots, setExistingSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🆕 Slot price (rupees) — admin har batch ke liye set karta hai.
  // Teacher select karne par teacher.pricePerSession se pre-fill hota hai.
  const [priceInput, setPriceInput] = useState('');

  // 🆕 Inline teacher-email add/edit state
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // ── Fetch teachers list ──
  useEffect(() => {
    const unsub = firestore()
      .collection('session_teachers')
      .onSnapshot(
        snapshot => {
          const list: Teacher[] = snapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              name: data.name || 'Unnamed Teacher',
              email: data.email || '',
              specialization: data.specialization || '',
              pricePerSession: data.pricePerSession ?? 0,
              sessionDurationMins: data.sessionDurationMins ?? 30,
              photoUrl: data.photoUrl,
            } as Teacher;
          });
          list.sort((a, b) => a.name.localeCompare(b.name));
          setTeachers(list);
          setLoadingTeachers(false);
        },
        err => {
          console.error('AdminSlotCreationScreen: teachers fetch error', err);
          setLoadingTeachers(false);
        }
      );
    return unsub;
  }, []);

  // 🆕 selectedTeacher ko live teachers list ke saath sync rakhte hain —
  // taaki agar kisi aur jagah se (ya isی screen ke email-save ke baad
  // dobara snapshot aane par) doc update ho, to yahan header card turant
  // latest email/naam dikhaye, stale copy nahi.
  useEffect(() => {
    if (!selectedTeacher) return;
    const latest = teachers.find(t => t.id === selectedTeacher.id);
    if (latest && latest.email !== selectedTeacher.email) {
      setSelectedTeacher(latest);
    }
  }, [teachers, selectedTeacher]);

  // ── Fetch existing slots for selected teacher + date ──
  useEffect(() => {
    if (!selectedTeacher) {
      setExistingSlots([]);
      return;
    }
    setLoadingSlots(true);
    const dateKey = toDateKey(selectedDate);
    const unsub = firestore()
      .collection('session_teachers')
      .doc(selectedTeacher.id)
      .collection('slots')
      .where('date', '==', dateKey)
      .onSnapshot(
        snapshot => {
          const list: TimeSlot[] = snapshot.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          setExistingSlots(list);
          setLoadingSlots(false);
        },
        err => {
          console.error('AdminSlotCreationScreen: slots fetch error', err);
          setLoadingSlots(false);
        }
      );
    return unsub;
  }, [selectedTeacher, selectedDate]);

  // Reset selected start times whenever teacher/date changes.
  useEffect(() => {
    setSelectedStartTimes(new Set());
  }, [selectedTeacher, selectedDate]);

  // 🆕 Teacher badalne par email-edit box bhi band kar dete hain (warna
  // purane teacher ka half-typed email naye teacher ke card pe reh jaata).
  useEffect(() => {
    setEditingEmail(false);
    setEmailInput('');
    // 🆕 naye teacher ke liye price default = uski pricePerSession
    setPriceInput(selectedTeacher ? String(selectedTeacher.pricePerSession || 500) : '');
  }, [selectedTeacher?.id]);

  const duration = selectedTeacher?.sessionDurationMins ?? 30;
  const startTimeOptions = useMemo(() => buildStartTimeOptions(duration), [duration]);
  const bookedOrExistingStarts = useMemo(
    () => new Set(existingSlots.map(s => s.startTime)),
    [existingSlots]
  );

  const toggleStartTime = (time: string) => {
    if (bookedOrExistingStarts.has(time)) return; // already exists, can't re-add
    setSelectedStartTimes(prev => {
      const next = new Set(prev);
      if (next.has(time)) next.delete(time);
      else next.add(time);
      return next;
    });
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  // ── Quick Add Teacher Function ──
  const handleQuickAddTeacher = async () => {
    const trimmedName = teacherSearch.trim();
    if (!trimmedName) return;
    try {
      const docRef = await firestore().collection('session_teachers').add({
        name: trimmedName,
        email: '',
        specialization: 'General',
        pricePerSession: 500,
        sessionDurationMins: 30,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      const newTeacher: Teacher = {
        id: docRef.id,
        name: trimmedName,
        email: '',
        specialization: 'General',
        pricePerSession: 500,
        sessionDurationMins: 30,
      };

      setSelectedTeacher(newTeacher);
      setTeacherSearch('');
      Alert.alert('Success', 'The teacher has been added! Now, it is mandatory to enter the teacher email below; otherwise, the slots will not be saved.');
    } catch (err) {
      console.error('AdminSlotCreationScreen: quick add teacher error', err);
      Alert.alert('Error', 'The teacher could not be added.');
    }
  };

  // 🆕 Teacher ka email save/update karna — validation ke saath. Bina
  // valid email ke bookings fail hoti hain (createBooking Cloud Function
  // side pe check hai), isliye yahan bhi basic client-side validation.
  const handleSaveTeacherEmail = async () => {
    if (!selectedTeacher) return;
    const trimmed = emailInput.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!isValidEmail) {
      Alert.alert('Invalid Email', 'Enter a valid email address (e.g., teacher@example.com).');
      return;
    }

    setSavingEmail(true);
    try {
      await firestore()
        .collection('session_teachers')
        .doc(selectedTeacher.id)
        .update({ email: trimmed });

      setSelectedTeacher({ ...selectedTeacher, email: trimmed });
      setEditingEmail(false);
      Alert.alert('Done', 'The teacher email has been updated. This teacher can now be booked.');
    } catch (err) {
      console.error('AdminSlotCreationScreen: save email error', err);
      Alert.alert('Error', 'The email could not be saved. Try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleAddSlots = useCallback(async () => {
    if (!selectedTeacher) {
      Alert.alert('Choose a teacher', 'First, select a teacher.');
      return;
    }
    // 🆕 Teacher email mandatory: bina email ke booking/teacher-side sessions kaam nahi karte
    if (!selectedTeacher.email) {
      Alert.alert('Email is required.', 'First, save this teacher email; then, you will be able to add slots.');
      return;
    }
    if (selectedStartTimes.size === 0) {
      Alert.alert('Select time', 'Select at least a start time.');
      return;
    }
    // 🆕 Price validation: sirf whole rupees, minimum ₹1
    const price = Number(priceInput);
    if (!Number.isInteger(price) || price < 1) {
      Alert.alert('The price is incorrect', 'Enter the slot price in whole rupees (minimum ₹1).');
      return;
    }
    setSaving(true);
    try {
      const dateKey = toDateKey(selectedDate);
      const batch = firestore().batch();
      const slotsRef = firestore()
        .collection('session_teachers')
        .doc(selectedTeacher.id)
        .collection('slots');

      selectedStartTimes.forEach(startTime => {
        const endTime = addMinutesToTime(startTime, duration);
        const docRef = slotsRef.doc();
        batch.set(docRef, {
          teacherId: selectedTeacher.id,
          date: dateKey,
          startTime,
          endTime,
          price, // 🆕 admin ki set ki hui slot price (rupees)
          isBooked: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      setSelectedStartTimes(new Set());
      Alert.alert('Ho gaya', `${selectedStartTimes.size} slot(s) add ho gaye.`);
    } catch (err) {
      console.error('AdminSlotCreationScreen: add slots error', err);
      Alert.alert('Error', 'Slots could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedTeacher, selectedDate, duration, selectedStartTimes, priceInput]);

  const handleDeleteSlot = useCallback(
    (slot: TimeSlot) => {
      if (slot.isBooked) {
        Alert.alert('Cannot be done', 'This slot is already booked; it cannot be deleted.');
        return;
      }
      if (!selectedTeacher) return;
      Alert.alert('Delete slot?', `${formatTimeLabel(slot.startTime)} - ${formatTimeLabel(slot.endTime)}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore()
                .collection('session_teachers')
                .doc(selectedTeacher.id)
                .collection('slots')
                .doc(slot.id)
                .delete();
            } catch (err) {
              console.error('AdminSlotCreationScreen: delete slot error', err);
              Alert.alert('Error', 'The slot could not be deleted..');
            }
          },
        },
      ]);
    },
    [selectedTeacher]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1220" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft color="#F8FAFC" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Add Session Slots</Text>
          <Text style={styles.headerSubtitle}>Create available time slots for the teacher.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* STEP 1: TEACHER */}
        <Text style={styles.sectionLabel}>1. Teacher</Text>
        {!selectedTeacher ? (
          <View style={styles.card}>
            <View style={styles.searchBox}>
              <Search color="#64748B" size={16} />
              <TextInput
                value={teacherSearch}
                onChangeText={setTeacherSearch}
                placeholder="Teacher search or add..."
                placeholderTextColor="#64748B"
                style={styles.searchInput}
              />
            </View>
            {loadingTeachers ? (
              <ActivityIndicator color="#38BDF8" style={{ marginVertical: 20 }} />
            ) : filteredTeachers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={styles.emptyText}>No teacher found.</Text>
                {teacherSearch.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.quickAddBtn}
                    onPress={handleQuickAddTeacher}
                    activeOpacity={0.8}
                  >
                    <Plus color="#0B1220" size={16} />
                    <Text style={styles.quickAddBtnText}>
                      Add "{teacherSearch.trim()}" as Teacher
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ maxHeight: 260 }}>
                <ScrollView nestedScrollEnabled>
                  {filteredTeachers.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.teacherRow}
                      onPress={() => setSelectedTeacher(t)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.teacherAvatar}>
                        <User color="#38BDF8" size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teacherName}>{t.name}</Text>
                        <Text style={styles.teacherSubject}>
                          {t.specialization || 'No specialization set'} · ₹{t.pricePerSession} · {t.sessionDurationMins} min
                        </Text>
                      </View>
                      {!t.email && (
                        <View style={styles.noEmailDot} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.card, styles.selectedTeacherCard]}
              onPress={() => setSelectedTeacher(null)}
              activeOpacity={0.75}
            >
              <View style={styles.teacherAvatar}>
                <User color="#38BDF8" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teacherName}>{selectedTeacher.name}</Text>
                <Text style={styles.teacherSubject}>
                  {selectedTeacher.specialization || 'No specialization set'} · ₹
                  {selectedTeacher.pricePerSession} · {selectedTeacher.sessionDurationMins} min/session
                </Text>
              </View>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>

            {/* 🆕 EMAIL SECTION — teen states: editing / missing (warning) / set (display+edit) */}
            {editingEmail || !selectedTeacher.email ? (
              <View style={styles.emailEditBox}>
                <Text style={{ color: !selectedTeacher.email ? '#F59E0B' : '#94A3B8', fontSize: 12.5, fontWeight: '700', marginBottom: 8 }}>
                  {!selectedTeacher.email
                    ? '⚠️ Teacher Email (Required) — Slots will be saved only after the email is saved.'
                    : 'Teacher Email'}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 11.5, marginBottom: 8 }}>
                  The teacher will log in using this email to view their sessions.
                </Text>
                <View style={styles.emailInputRow}>
                  <Mail color="#64748B" size={16} />
                  <TextInput
                    value={emailInput}
                    onChangeText={setEmailInput}
                    placeholder="teacher@example.com"
                    placeholderTextColor="#64748B"
                    style={styles.emailInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoFocus={editingEmail}
                  />
                </View>
                <View style={styles.emailEditActions}>
                  {!!selectedTeacher.email && (
                    <TouchableOpacity
                      onPress={() => setEditingEmail(false)}
                      style={styles.emailCancelBtn}
                      disabled={savingEmail}
                    >
                      <Text style={styles.emailCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleSaveTeacherEmail}
                    style={styles.emailSaveBtn}
                    disabled={savingEmail}
                  >
                    {savingEmail ? (
                      <ActivityIndicator color="#0B1220" size="small" />
                    ) : (
                      <Text style={styles.emailSaveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.emailDisplayRow}
                onPress={() => {
                  setEmailInput(selectedTeacher.email);
                  setEditingEmail(true);
                }}
                activeOpacity={0.7}
              >
                <Mail color="#64748B" size={13} />
                <Text style={styles.emailDisplayText}>{selectedTeacher.email}</Text>
                <Pencil color="#64748B" size={12} />
              </TouchableOpacity>
            )}
          </>
        )}

        {selectedTeacher && (
          <>
            {/* STEP 2: DATE */}
            <Text style={styles.sectionLabel}>2. Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
            >
              {nextDays.map(d => {
                const active = toDateKey(d) === toDateKey(selectedDate);
                return (
                  <TouchableOpacity
                    key={toDateKey(d)}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setSelectedDate(d)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>
                      {DAY_LABELS[d.getDay()]}
                    </Text>
                    <Text style={[styles.dateChipNum, active && styles.dateChipTextActive]}>
                      {d.getDate()}
                    </Text>
                    <Text style={[styles.dateChipMonth, active && styles.dateChipTextActive]}>
                      {MONTH_LABELS[d.getMonth()]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* STEP 3: START TIMES */}
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>3. Start Time(s)</Text>
              {selectedStartTimes.size > 0 && (
                <Text style={styles.selectedCountText}>{selectedStartTimes.size} selected</Text>
              )}
            </View>
            <View style={styles.durationNoteRow}>
              <Clock color="#64748B" size={13} />
              <Text style={styles.durationNoteText}>
                Every slot {duration}It will be made from ({selectedTeacher.name} fixed session duration)
              </Text>
            </View>
            <View style={styles.timeGrid}>
              {startTimeOptions.map(time => {
                const taken = bookedOrExistingStarts.has(time);
                const active = selectedStartTimes.has(time);
                return (
                  <TouchableOpacity
                    key={time}
                    disabled={taken}
                    style={[
                      styles.timeChip,
                      active && styles.timeChipActive,
                      taken && styles.timeChipDisabled,
                    ]}
                    onPress={() => toggleStartTime(time)}
                    activeOpacity={0.75}
                  >
                    {active && <Check color="#0B1220" size={12} style={{ marginRight: 4 }} />}
                    <Text
                      style={[
                        styles.timeChipText,
                        active && styles.timeChipTextActive,
                        taken && styles.timeChipTextDisabled,
                      ]}
                    >
                      {formatTimeLabel(time)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 🆕 SLOT PRICE — is batch ke saare slots ki price */}
            <Text style={styles.sectionLabel}>4. Price per slot (₹)</Text>
            <View style={styles.emailInputRow}>
              <Text style={{ color: '#94A3B8', fontSize: 15, fontWeight: '700' }}>₹</Text>
              <TextInput
                value={priceInput}
                onChangeText={t => setPriceInput(t.replace(/[^0-9]/g, ''))}
                placeholder="500"
                placeholderTextColor="#64748B"
                style={styles.emailInput}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || selectedStartTimes.size === 0 || !selectedTeacher.email) && styles.saveBtnDisabled,
              ]}
              onPress={handleAddSlots}
              disabled={saving || selectedStartTimes.size === 0 || !selectedTeacher.email}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#0B1220" />
              ) : (
                <>
                  <Plus color="#0B1220" size={18} />
                  <Text style={styles.saveBtnText}>
                    {!selectedTeacher.email
                      ? 'Pehle teacher email save karo'
                      : selectedStartTimes.size > 0
                      ? `Add ${selectedStartTimes.size} Slot${selectedStartTimes.size > 1 ? 's' : ''}`
                      : 'Add Slots'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* EXISTING SLOTS FOR THIS DATE */}
            <View style={styles.sectionLabelRow}>
              <CalendarIcon color="#94A3B8" size={14} />
              <Text style={[styles.sectionLabel, { marginLeft: 6 }]}>
                Already added — {DAY_LABELS[selectedDate.getDay()]}, {selectedDate.getDate()}{' '}
                {MONTH_LABELS[selectedDate.getMonth()]}
              </Text>
            </View>
            {loadingSlots ? (
              <ActivityIndicator color="#38BDF8" style={{ marginVertical: 16 }} />
            ) : existingSlots.length === 0 ? (
              <Text style={styles.emptyText}>There are no slots available for this date yet.</Text>
            ) : (
              <View style={styles.card}>
                {existingSlots.map((slot, idx) => (
                  <View
                    key={slot.id}
                    style={[
                      styles.existingSlotRow,
                      idx !== existingSlots.length - 1 && styles.existingSlotDivider,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.existingSlotTime}>
                        {formatTimeLabel(slot.startTime)} - {formatTimeLabel(slot.endTime)}
                      </Text>
                      <Text
                        style={[
                          styles.existingSlotStatus,
                          slot.isBooked ? styles.statusBooked : styles.statusOpen,
                        ]}
                      >
                        {slot.isBooked ? 'Booked' : 'Open'}
                        {' · ₹'}
                        {slot.price ?? selectedTeacher.pricePerSession}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteSlot(slot)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      disabled={slot.isBooked}
                    >
                      <Trash2 color={slot.isBooked ? '#334155' : '#EF4444'} size={18} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  selectedCountText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(30,41,59,0.9)',
    borderRadius: 16,
    padding: 12,
  },
  selectedTeacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    padding: 0,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  teacherAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  teacherSubject: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  changeLink: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    paddingVertical: 12,
    textAlign: 'center',
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    gap: 6,
  },
  quickAddBtnText: {
    color: '#0B1220',
    fontSize: 13,
    fontWeight: '700',
  },
  // 🆕 Chhota red dot teacher-list row me, jab email missing ho — admin
  // ko list scan karte waqt hi pata chal jaaye kis teacher ki email
  // pending hai, bina har row tap kiye.
  noEmailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  dateStrip: {
    gap: 8,
    paddingRight: 8,
  },
  dateChip: {
    width: 56,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: '#38BDF8',
  },
  dateChipDay: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  dateChipNum: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 2,
  },
  dateChipMonth: {
    color: '#94A3B8',
    fontSize: 11,
  },
  dateChipTextActive: {
    color: '#0B1220',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 17,
  },
  // 🆕 Email edit box — jab admin warning tap kare ya "set" state me
  // pencil icon tap kare.
  emailEditBox: {
    backgroundColor: 'rgba(30,41,59,0.9)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  emailInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    padding: 0,
  },
  emailEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  emailCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emailCancelBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  emailSaveBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  emailSaveBtnText: {
    color: '#0B1220',
    fontSize: 13,
    fontWeight: '700',
  },
  // 🆕 Email already-set state — chhota row jo tap karne se edit-mode
  // khol deta hai.
  emailDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  emailDisplayText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
  },
  durationNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  durationNoteText: {
    color: '#64748B',
    fontSize: 12,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(30,41,59,0.9)',
  },
  timeChipActive: {
    backgroundColor: '#38BDF8',
  },
  timeChipDisabled: {
    backgroundColor: 'rgba(30,41,59,0.4)',
  },
  timeChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  timeChipTextActive: {
    color: '#0B1220',
  },
  timeChipTextDisabled: {
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(56,189,248,0.3)',
  },
  saveBtnText: {
    color: '#0B1220',
    fontSize: 14,
    fontWeight: '700',
  },
  existingSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  existingSlotDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  existingSlotTime: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  existingSlotStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statusOpen: {
    color: '#10B981',
  },
  statusBooked: {
    color: '#F59E0B',
  },
});