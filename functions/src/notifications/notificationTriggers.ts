// functions/src/notifications/notificationTriggers.ts
//
// Creates a notification document for a user and sends a push to all of their devices.
// admin.initializeApp() is already called in functions/src/index.ts, so it is not repeated here.

import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Firestore triggers must run in the same region as the Firestore database (asia-south2)
const FIRESTORE_REGION = 'asia-south2';

type NotificationType = 'streak' | 'room' | 'badge' | 'like';

interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  targetRoomId?: string;
  targetBadgeId?: string;
  targetScreen?: string;
}

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

/**
 * Saves a notification at users/{uid}/notifications and pushes it to the user's devices.
 */
export async function sendNotificationToUser(uid: string, input: NotificationInput) {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const notifRef = userRef.collection('notifications').doc();

  const doc: Record<string, any> = {
    type: input.type,
    title: input.title,
    body: input.body,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const data: Record<string, string> = { type: input.type, notificationId: notifRef.id };

  if (input.targetRoomId) {
    doc.targetRoomId = input.targetRoomId;
    data.targetRoomId = input.targetRoomId;
  }
  if (input.targetBadgeId) {
    doc.targetBadgeId = input.targetBadgeId;
    data.targetBadgeId = input.targetBadgeId;
  }
  if (input.targetScreen) {
    doc.targetScreen = input.targetScreen;
    data.targetScreen = input.targetScreen;
  }

  await notifRef.set(doc);

  const userSnap = await userRef.get();
  const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: input.title, body: input.body },
    data,
    android: { priority: 'high', notification: { channelId: 'default' } },
  });

  // Remove device tokens that are no longer valid
  const invalid: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && INVALID_TOKEN_CODES.includes(r.error.code)) {
      invalid.push(tokens[i]);
    }
  });
  if (invalid.length > 0) {
    await userRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid) });
  }
}

// Finds a user id from an email address. Returns null if the account does not exist.
async function getUidByEmail(email?: string): Promise<string | null> {
  if (!email) return null;
  try {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  } catch {
    return null;
  }
}

/**
 * Trigger: runs whenever a booking document changes.
 *  - status becomes "confirmed" -> notify student and teacher
 *  - status becomes "cancelled" -> notify student and teacher
 */
export const onBookingStatusChange = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: FIRESTORE_REGION },
  async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  let title: string;
  let studentBody: string;
  let teacherBody: string;

  if (after.status === 'confirmed') {
    title = 'Session confirmed';
    studentBody = 'Your 1-to-1 session has been confirmed.';
    teacherBody = 'A new 1-to-1 session has been confirmed with a student.';
  } else if (after.status === 'cancelled') {
    title = 'Session cancelled';
    studentBody = 'Your 1-to-1 session has been cancelled.';
    teacherBody = 'A 1-to-1 session with a student has been cancelled.';
  } else {
    return;
  }

  const teacherUid = await getUidByEmail(
    typeof after.teacherEmail === 'string' ? after.teacherEmail : undefined,
  );

  const jobs: Promise<void>[] = [];
  if (typeof after.studentId === 'string') {
    jobs.push(sendNotificationToUser(after.studentId, {
        type: 'room',
        title,
        body: studentBody,
        targetScreen: 'UpcomingSessionsListScreen',
      }));
  }
  if (teacherUid) {
    jobs.push(sendNotificationToUser(teacherUid, {
        type: 'room',
        title,
        body: teacherBody,
        targetScreen: 'UpcomingSessionsListScreen',
      }));
  }
  await Promise.allSettled(jobs);
  },
);

// ─────────────────────────────────────────────
// NEW SESSION SLOT -> notify all users
// ─────────────────────────────────────────────

// Slots are saved as a subcollection of each teacher: session_teachers/{teacherId}/slots/{slotId}
const SLOT_PATH = 'session_teachers/{teacherId}/slots/{slotId}';

// A teacher often adds many slots one after another. To avoid sending a push for every
// single slot, at most one broadcast is sent per this many minutes.
const SLOT_BROADCAST_COOLDOWN_MINUTES = 30;

/**
 * Sends one notification to every user (saved in each user's notifications + push).
 * Users are read in pages so this works with a large number of users.
 * skipUid: optional user id that should not receive it (for example the creator).
 */
export async function sendNotificationToAllUsers(input: NotificationInput, skipUid?: string) {
  const db = admin.firestore();
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collection('users')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(300);
    if (last) query = query.startAfter(last);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    const tokens: string[] = [];

    snap.docs.forEach(d => {
      if (d.id === skipUid) return;
      const doc: Record<string, any> = {
        type: input.type,
        title: input.title,
        body: input.body,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (input.targetRoomId) doc.targetRoomId = input.targetRoomId;
      if (input.targetBadgeId) doc.targetBadgeId = input.targetBadgeId;
      if (input.targetScreen) doc.targetScreen = input.targetScreen;
      batch.set(d.ref.collection('notifications').doc(), doc);
      tokens.push(...((d.data().fcmTokens as string[] | undefined) ?? []));
    });
    await batch.commit();

    for (let i = 0; i < tokens.length; i += 500) {
      await admin.messaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + 500),
        notification: { title: input.title, body: input.body },
        data: {
          type: input.type,
          ...(input.targetScreen ? { targetScreen: input.targetScreen } : {}),
        },
        android: { priority: 'high', notification: { channelId: 'default' } },
      });
    }

    last = snap.docs[snap.docs.length - 1];
  }
}

/**
 * Trigger: runs when a new slot document is created.
 * Notifies all users once per cooldown window.
 */
export const onSlotCreated = onDocumentCreated(
  { document: SLOT_PATH, region: FIRESTORE_REGION },
  async event => {
  const slot = event.data?.data();
  if (!slot) return;

  const teacherId = event.params.teacherId;
  const db = admin.firestore();

  // The teacher's name and email live on the parent document
  const teacherSnap = await db.collection('session_teachers').doc(teacherId).get();
  const teacher = teacherSnap.data();

  // Cooldown check (per teacher) inside a transaction so parallel slot creations send only one broadcast
  const metaRef = db.collection('notificationMeta').doc(`slotBroadcast_${teacherId}`);
  const shouldSend = await db.runTransaction(async tx => {
    const meta = await tx.get(metaRef);
    const lastSent: admin.firestore.Timestamp | undefined = meta.data()?.lastSentAt;
    const cooldownMs = SLOT_BROADCAST_COOLDOWN_MINUTES * 60 * 1000;
    if (lastSent && Date.now() - lastSent.toMillis() < cooldownMs) return false;
    tx.set(metaRef, { lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
  if (!shouldSend) return;

  const teacherName = typeof teacher?.name === 'string' ? teacher.name : '';
  const teacherUid = await getUidByEmail(
    typeof teacher?.email === 'string' ? teacher.email : undefined,
  );
  await sendNotificationToAllUsers(
    {
      type: 'room',
      title: 'New session slots available',
      targetScreen: 'OneToOneSessionsScreen',
      body: teacherName
        ? `${teacherName} has added new 1-to-1 session slots. Book yours now.`
        : 'New 1-to-1 session slots have been added. Book yours now.',
    },
    teacherUid ?? undefined, // the teacher does not need to be notified about their own slots
  );
  },
);

// ─────────────────────────────────────────────
// SCHEDULED TRIGGERS: session reminder and daily streak reminder
// ─────────────────────────────────────────────

// IMPORTANT: change these names to match your Firestore data
const BOOKING_START_FIELD = 'startTime'; // Timestamp field on bookings/{id} with the session start time
const STREAK_FIELD = 'streak'; // number field on users/{uid}
const LAST_PRACTICE_FIELD = 'lastPracticeDate'; // Timestamp or "YYYY-MM-DD" string on users/{uid}

// Converts a Timestamp, Date or date string into a "YYYY-MM-DD" day key in Indian time
function toDayKey(value: any): string | null {
  let ms: number | null = null;
  if (value && typeof value.toMillis === 'function') ms = value.toMillis();
  else if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) ms = parsed;
  }
  if (ms === null) return null;
  return new Date(ms + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Runs every 5 minutes. Finds confirmed sessions that start in the next 10 to 15 minutes
 * and reminds both the student and the teacher. Each booking is reminded only once.
 */
export const sendSessionReminders = onSchedule('every 5 minutes', async () => {
  const db = admin.firestore();
  const now = Date.now();
  const from = admin.firestore.Timestamp.fromMillis(now + 10 * 60 * 1000);
  const to = admin.firestore.Timestamp.fromMillis(now + 15 * 60 * 1000);

  const snap = await db
    .collection('bookings')
    .where(BOOKING_START_FIELD, '>=', from)
    .where(BOOKING_START_FIELD, '<', to)
    .get();

  for (const d of snap.docs) {
    const booking = d.data();
    if (booking.status !== 'confirmed' || booking.reminderSent) continue;

    // Mark first so the same booking is never reminded twice
    await d.ref.update({ reminderSent: true });

    const teacherUid = await getUidByEmail(
      typeof booking.teacherEmail === 'string' ? booking.teacherEmail : undefined,
    );

    const jobs: Promise<void>[] = [];
    if (typeof booking.studentId === 'string') {
      jobs.push(
        sendNotificationToUser(booking.studentId, {
          type: 'room',
          title: 'Session starting soon',
          targetScreen: 'UpcomingSessionsListScreen',
          body: 'Your 1-to-1 session starts in less than 15 minutes. Get ready to join.',
        }),
      );
    }
    if (teacherUid) {
      jobs.push(
        sendNotificationToUser(teacherUid, {
          type: 'room',
          title: 'Session starting soon',
          targetScreen: 'UpcomingSessionsListScreen',
          body: 'Your 1-to-1 session with a student starts in less than 15 minutes.',
        }),
      );
    }
    await Promise.allSettled(jobs);
  }
});

/**
 * Runs every day at 8 PM India time. Reminds users who have an active streak
 * but have not practiced today yet.
 */
export const sendStreakReminders = onSchedule(
  { schedule: '0 20 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const today = toDayKey(Date.now());
    let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (;;) {
      let query = db
        .collection('users')
        .where(STREAK_FIELD, '>', 0)
        .orderBy(STREAK_FIELD)
        .limit(200);
      if (last) query = query.startAfter(last);

      const snap = await query.get();
      if (snap.empty) break;

      const due = snap.docs.filter(d => {
        const lastDay = toDayKey(d.data()[LAST_PRACTICE_FIELD]);
        // Skip users who already practiced today, or whose date cannot be read
        return lastDay !== null && lastDay !== today;
      });

      for (let i = 0; i < due.length; i += 25) {
        await Promise.allSettled(
          due.slice(i, i + 25).map(d =>
            sendNotificationToUser(d.id, {
              type: 'streak',
              title: 'Streak alert',
              body: `You're on a ${d.data()[STREAK_FIELD]}-day streak! Speak today to keep it alive.`,
            }),
          ),
        );
      }

      last = snap.docs[snap.docs.length - 1];
    }
  },
);