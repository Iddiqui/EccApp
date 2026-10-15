// functions/src/notifications/notificationTriggers.ts
//
// Every notification in the app is created here.
// A notification = one document at users/{uid}/notifications (shown in the Notifications
// screen) + a push to all of the user's devices (users/{uid}.fcmTokens).
// admin.initializeApp() is already called in functions/src/index.ts, so it is not repeated here.
//
// Features covered:
//   1-to-1 / demo sessions : booked, confirmed, cancelled, reminders (1 hour and 10 minutes before)
//   Audio group classes    : new class, seat booked, class cancelled, reminders
//   Plans / payments       : payment successful, plan ending in 3 days, plan expired
//   Study / Class rooms    : a room went live
//   Community              : admin announcements (feed), new chat messages
//   Challenges             : new challenge, new daily challenge
//   Streak                 : daily reminder, milestones, streak ended
//   Teachers               : teacher access given, new review, new session slots

import * as admin from 'firebase-admin';
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Firestore triggers must run in the same region as the Firestore database (asia-south2)
const FIRESTORE_REGION = 'asia-south2';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NotificationType =
  | 'streak'
  | 'room'
  | 'badge'
  | 'like'
  | 'session'
  | 'audio'
  | 'payment'
  | 'community'
  | 'challenge'
  | 'review';

interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  targetRoomId?: string;
  targetBadgeId?: string;
  targetScreen?: string; // a screen name, "VoiceRoomScreen" or "Dashboard"
  targetTab?: string; // tab for VoiceRoomScreen (public | official) or for Dashboard (Home | Community ...)
  pushOnly?: boolean; // true = push only, nothing is saved in the Notifications screen
}

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

// ─────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────

function buildDoc(input: NotificationInput): Record<string, any> {
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
  if (input.targetTab) doc.targetTab = input.targetTab;
  return doc;
}

function buildData(input: NotificationInput, notificationId?: string): Record<string, string> {
  const data: Record<string, string> = { type: input.type };
  if (notificationId) data.notificationId = notificationId;
  if (input.targetRoomId) data.targetRoomId = input.targetRoomId;
  if (input.targetBadgeId) data.targetBadgeId = input.targetBadgeId;
  if (input.targetScreen) data.targetScreen = input.targetScreen;
  if (input.targetTab) data.targetTab = input.targetTab;
  return data;
}

const istDayKey = (ms: number): string => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
const istMs = (date: string, time: string): number => new Date(`${date}T${time}:00+05:30`).getTime();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-10-12", "16:30" -> "12 Oct, 16:30"
function prettyWhen(date?: any, time?: any): string {
  const t = typeof time === 'string' ? time : '';
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return t;
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}${t ? `, ${t}` : ''}`;
}

const clip = (s: any, n: number): string => {
  const text = typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
};

// Converts a Timestamp, Date or date string into a "YYYY-MM-DD" day key in Indian time
function toDayKey(value: any): string | null {
  let ms: number | null = null;
  if (value && typeof value.toMillis === 'function') ms = value.toMillis();
  else if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) ms = parsed;
  }
  if (ms === null) return null;
  return istDayKey(ms);
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

// Same admin list the Admin Panel uses: the `admins` collection, matched by email.
async function isAdminUid(uid: string): Promise<boolean> {
  try {
    const user = await admin.auth().getUser(uid);
    const email = (user.email || '').toLowerCase();
    if (!email) return false;
    const snap = await admin.firestore().collection('admins').where('email', '==', email).limit(1).get();
    return !snap.empty;
  } catch {
    return false;
  }
}

// Lets only one caller through per key per cooldown window (used to avoid push spam).
async function acquireCooldown(key: string, minutes: number): Promise<boolean> {
  const db = admin.firestore();
  const metaRef = db.collection('notificationMeta').doc(key);
  return db.runTransaction(async tx => {
    const meta = await tx.get(metaRef);
    const lastSent: admin.firestore.Timestamp | undefined = meta.data()?.lastSentAt;
    if (lastSent && Date.now() - lastSent.toMillis() < minutes * 60 * 1000) return false;
    tx.set(metaRef, { lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

// ─────────────────────────────────────────────
// SENDING
// ─────────────────────────────────────────────

/**
 * Saves a notification at users/{uid}/notifications and pushes it to the user's devices.
 */
export async function sendNotificationToUser(uid: string, input: NotificationInput): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  let notificationId: string | undefined;
  if (!input.pushOnly) {
    const notifRef = userRef.collection('notifications').doc();
    notificationId = notifRef.id;
    await notifRef.set(buildDoc(input));
  }

  const userSnap = await userRef.get();
  const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: input.title, body: input.body },
    data: buildData(input, notificationId),
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

/** Same notification for a list of users (duplicates removed, sent in small parallel groups). */
export async function sendNotificationToUsers(uids: string[], input: NotificationInput): Promise<void> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 20) {
    await Promise.allSettled(unique.slice(i, i + 20).map(uid => sendNotificationToUser(uid, input)));
  }
}

/**
 * Sends one notification to every user (saved in each user's notifications + push).
 * Users are read in pages so this works with a large number of users.
 * skipUid: optional user id that should not receive it (for example the creator).
 */
export async function sendNotificationToAllUsers(input: NotificationInput, skipUid?: string): Promise<void> {
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
      batch.set(d.ref.collection('notifications').doc(), buildDoc(input));
      tokens.push(...((d.data().fcmTokens as string[] | undefined) ?? []));
    });
    await batch.commit();

    for (let i = 0; i < tokens.length; i += 500) {
      await admin.messaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + 500),
        notification: { title: input.title, body: input.body },
        data: buildData(input),
        android: { priority: 'high', notification: { channelId: 'default' } },
      });
    }

    last = snap.docs[snap.docs.length - 1];
  }
}

// ═════════════════════════════════════════════
// 1-TO-1 AND DEMO SESSIONS (bookings)
// ═════════════════════════════════════════════

async function notifyBookingParties(
  booking: FirebaseFirestore.DocumentData,
  title: string,
  studentBody: string,
  teacherBody: string,
): Promise<void> {
  const teacherUid = await getUidByEmail(
    typeof booking.teacherEmail === 'string' ? booking.teacherEmail : undefined,
  );

  const jobs: Promise<void>[] = [];
  if (typeof booking.studentId === 'string') {
    jobs.push(
      sendNotificationToUser(booking.studentId, {
        type: 'session',
        title,
        body: studentBody,
        targetScreen: 'UpcomingSessionsListScreen',
      }),
    );
  }
  if (teacherUid) {
    jobs.push(
      sendNotificationToUser(teacherUid, {
        type: 'session',
        title,
        body: teacherBody,
        targetScreen: 'UpcomingSessionsListScreen',
      }),
    );
  }
  await Promise.allSettled(jobs);
}

const bookingLabel = (b: FirebaseFirestore.DocumentData): string =>
  b.kind === 'demo' ? 'demo class' : '1-to-1 session';

/**
 * A booking that is created already confirmed (plan sessions, free demo class).
 * Paid bookings are created as "pending_payment" and are handled by onBookingStatusChange.
 */
export const onBookingCreated = onDocumentCreated(
  { document: 'bookings/{bookingId}', region: FIRESTORE_REGION },
  async event => {
    const booking = event.data?.data();
    if (!booking || booking.status !== 'confirmed') return;
    const label = bookingLabel(booking);
    const when = prettyWhen(booking.date, booking.startTime);
    await notifyBookingParties(
      booking,
      label === 'demo class' ? 'Demo class booked' : 'Session booked',
      `Your ${label} is booked${when ? ` for ${when}` : ''}.`,
      `A student booked a ${label}${when ? ` for ${when}` : ''}.`,
    );
  },
);

/**
 * Trigger: runs whenever a booking document changes.
 *  - status becomes "confirmed" (payment done) -> notify student and teacher
 *  - status becomes "cancelled" -> notify student and teacher
 */
export const onBookingStatusChange = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: FIRESTORE_REGION },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;

    const label = bookingLabel(after);
    const when = prettyWhen(after.date, after.startTime);

    if (after.status === 'confirmed') {
      await notifyBookingParties(
        after,
        'Session confirmed',
        `Your ${label} has been confirmed${when ? ` for ${when}` : ''}.`,
        `A new ${label} has been confirmed with a student${when ? ` for ${when}` : ''}.`,
      );
    } else if (after.status === 'cancelled') {
      await notifyBookingParties(
        after,
        'Session cancelled',
        `Your ${label}${when ? ` on ${when}` : ''} has been cancelled.`,
        `A ${label} with a student${when ? ` on ${when}` : ''} has been cancelled.`,
      );
    }
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
 * Trigger: runs when a new slot document is created.
 * Notifies all users once per cooldown window.
 */
export const onSlotCreated = onDocumentCreated(
  { document: SLOT_PATH, region: FIRESTORE_REGION },
  async event => {
    const slot = event.data?.data();
    if (!slot) return;

    const teacherId = event.params.teacherId;
    const teacherSnap = await admin.firestore().collection('session_teachers').doc(teacherId).get();
    const teacher = teacherSnap.data();

    // Cooldown check (per teacher) so parallel slot creations send only one broadcast
    if (!(await acquireCooldown(`slotBroadcast_${teacherId}`, SLOT_BROADCAST_COOLDOWN_MINUTES))) return;

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

// ═════════════════════════════════════════════
// TEACHERS (access given, new review)
// ═════════════════════════════════════════════

/** Admin gave (or re-activated) teacher access -> tell the teacher. */
export const onTeacherAdded = onDocumentWritten(
  { document: 'session_teachers/{teacherId}', region: FIRESTORE_REGION },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const wasActive = before ? before.isActive !== false : false;
    const isActive = after ? after.isActive !== false : false;
    if (wasActive || !isActive) return;

    const uid = await getUidByEmail(typeof after?.email === 'string' ? after.email : undefined);
    if (!uid) return;
    await sendNotificationToUser(uid, {
      type: 'session',
      title: 'You are now a teacher on ECC',
      body: 'Teacher access is on for your account. Open your Teacher Dashboard to add slots and classes.',
      targetScreen: 'TeacherDashboardScreen',
    });
  },
);

/** A student rated a session -> tell the teacher. */
export const onReviewCreated = onDocumentCreated(
  { document: 'session_teachers/{teacherId}/reviews/{reviewId}', region: FIRESTORE_REGION },
  async event => {
    const review = event.data?.data();
    if (!review) return;
    const teacherSnap = await admin.firestore().collection('session_teachers').doc(event.params.teacherId).get();
    const uid = await getUidByEmail(
      typeof teacherSnap.data()?.email === 'string' ? teacherSnap.data()!.email : undefined,
    );
    if (!uid) return;
    const rating = Number(review.rating) || 0;
    const comment = clip(review.comment, 80);
    await sendNotificationToUser(uid, {
      type: 'review',
      title: `New review: ${rating}/5 ⭐`,
      body: comment
        ? `${review.studentName || 'A student'}: "${comment}"`
        : `${review.studentName || 'A student'} rated your session ${rating} out of 5.`,
      targetScreen: 'TeacherDashboardScreen',
    });
  },
);

// ═════════════════════════════════════════════
// AUDIO GROUP CLASSES
// ═════════════════════════════════════════════

/** Teacher created a class -> tell students whose active audio plan is linked to this teacher. */
export const onAudioSessionCreated = onDocumentCreated(
  { document: 'audioSessions/{sessionId}', region: FIRESTORE_REGION },
  async event => {
    const s = event.data?.data();
    if (!s || s.status !== 'scheduled' || typeof s.teacherId !== 'string') return;

    const subs = await admin.firestore().collection('subscriptions').where('teacherId', '==', s.teacherId).get();
    const now = Date.now();
    const uids: string[] = [];
    subs.docs.forEach(d => {
      const sub = d.data();
      const exp = sub.expiresAt?.toMillis?.() ?? 0;
      if (sub.mode === 'audio' && sub.status === 'active' && exp > now && typeof sub.userId === 'string') {
        uids.push(sub.userId);
      }
    });
    if (uids.length === 0) return;

    await sendNotificationToUsers(uids, {
      type: 'audio',
      title: 'New audio class',
      body: `${clip(s.title, 60)} with ${s.teacherName || 'your teacher'} on ${prettyWhen(s.date, s.startTime)}. Book your seat.`,
      targetScreen: 'VoiceRoomScreen',
      targetTab: 'official',
    });
  },
);

/** A student booked a seat -> confirm to the student and tell the teacher. */
export const onAudioAttendeeCreated = onDocumentCreated(
  { document: 'audioSessions/{sessionId}/attendees/{attendeeId}', region: FIRESTORE_REGION },
  async event => {
    const attendee = event.data?.data();
    if (!attendee) return;
    const sSnap = await admin.firestore().collection('audioSessions').doc(event.params.sessionId).get();
    const s = sSnap.data();
    if (!s) return;
    const when = prettyWhen(s.date, s.startTime);

    const jobs: Promise<void>[] = [
      sendNotificationToUser(event.params.attendeeId, {
        type: 'audio',
        title: 'Seat booked',
        body: `You are in: ${clip(s.title, 60)} on ${when}.`,
        targetScreen: 'VoiceRoomScreen',
        targetTab: 'official',
      }),
    ];
    const teacherUid = await getUidByEmail(typeof s.teacherEmail === 'string' ? s.teacherEmail : undefined);
    if (teacherUid) {
      jobs.push(
        sendNotificationToUser(teacherUid, {
          type: 'audio',
          title: 'New seat booked',
          body: `${attendee.studentName || 'A student'} joined "${clip(s.title, 50)}" (${when}).`,
          targetScreen: 'TeacherAudioSessionsScreen',
        }),
      );
    }
    await Promise.allSettled(jobs);
  },
);

/** Class cancelled -> tell everyone who booked a seat. */
export const onAudioSessionCancelled = onDocumentUpdated(
  { document: 'audioSessions/{sessionId}', region: FIRESTORE_REGION },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === 'cancelled' || after.status !== 'cancelled') return;

    const attendees = await event.data!.after.ref.collection('attendees').get();
    const uids = attendees.docs.map(d => d.id);
    if (uids.length === 0) return;
    await sendNotificationToUsers(uids, {
      type: 'audio',
      title: 'Class cancelled',
      body: `${clip(after.title, 60)} on ${prettyWhen(after.date, after.startTime)} has been cancelled.`,
      targetScreen: 'VoiceRoomScreen',
      targetTab: 'official',
    });
  },
);

// ═════════════════════════════════════════════
// PLANS AND PAYMENTS
// ═════════════════════════════════════════════

/** Payment became "paid" -> tell the user. */
export const onPaymentPaid = onDocumentWritten(
  { document: 'payments/{paymentId}', region: FIRESTORE_REGION },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.status !== 'paid' || before?.status === 'paid') return;
    if (typeof after.userId !== 'string') return;

    const summary = after.programSummary || {};
    const mode: string | undefined = summary.mode || after.mode;
    const planName: string = summary.planName || after.planName || '';

    if (after.type === 'program') {
      const isAudio = mode === 'audio';
      await sendNotificationToUser(after.userId, {
        type: 'payment',
        title: 'Payment successful',
        body: planName
          ? `Your ${planName} plan is now active. Enjoy learning!`
          : `Your ${isAudio ? 'audio' : 'video'} plan is now active. Enjoy learning!`,
        targetScreen: isAudio ? 'VoiceRoomScreen' : 'OneToOneSessionsScreen',
        targetTab: isAudio ? 'official' : undefined,
      });
    } else if (after.type === 'one_to_one') {
      await sendNotificationToUser(after.userId, {
        type: 'payment',
        title: 'Payment successful',
        body: 'Your payment was received and your session is confirmed.',
        targetScreen: 'UpcomingSessionsListScreen',
      });
    } else {
      await sendNotificationToUser(after.userId, {
        type: 'payment',
        title: 'Payment successful',
        body: 'Your subscription is now active.',
        targetScreen: 'SubscriptionScreen',
      });
    }
  },
);

/**
 * Runs every day at 10 AM India time.
 *  - plans that end in about 3 days  -> "ending soon"
 *  - plans that ended in the last day -> "expired"
 * Only the time range is queried (no extra index needed); status is checked in code.
 */
export const sendPlanExpiryReminders = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const ts = (ms: number) => admin.firestore.Timestamp.fromMillis(ms);

    const warnSnap = await db
      .collection('subscriptions')
      .where('expiresAt', '>=', ts(now + 2 * DAY_MS))
      .where('expiresAt', '<', ts(now + 3 * DAY_MS))
      .get();
    for (const d of warnSnap.docs) {
      const sub = d.data();
      if (sub.status !== 'active' || sub.expiryWarned || typeof sub.userId !== 'string') continue;
      await d.ref.update({ expiryWarned: true });
      await sendNotificationToUser(sub.userId, {
        type: 'payment',
        title: 'Your plan ends in 3 days',
        body: `${sub.planName || 'Your plan'} is about to end. Renew now so your classes do not stop.`,
        targetScreen: 'ProgramFlowScreen',
      }).catch(() => {});
    }

    const expiredSnap = await db
      .collection('subscriptions')
      .where('expiresAt', '>=', ts(now - DAY_MS))
      .where('expiresAt', '<', ts(now))
      .get();
    for (const d of expiredSnap.docs) {
      const sub = d.data();
      if (sub.status !== 'active' || sub.expiredNotified || typeof sub.userId !== 'string') continue;
      await d.ref.update({ expiredNotified: true });
      await sendNotificationToUser(sub.userId, {
        type: 'payment',
        title: 'Your plan has expired',
        body: `${sub.planName || 'Your plan'} has ended. Renew to keep joining classes and sessions.`,
        targetScreen: 'ProgramFlowScreen',
      }).catch(() => {});
    }
  },
);

// ═════════════════════════════════════════════
// SESSION AND CLASS REMINDERS (every 5 minutes)
// ═════════════════════════════════════════════

const REMINDER_WINDOWS = [
  { flag: 'reminder1hSent', fromMin: 55, toMin: 60, text: 'in about 1 hour' },
  { flag: 'reminderSent', fromMin: 10, toMin: 15, text: 'in less than 15 minutes' },
];

/**
 * Runs every 5 minutes. Reminds about confirmed 1-to-1 / demo sessions and audio classes
 * about 1 hour before and again 10 to 15 minutes before they start. Each reminder is sent once.
 *
 * Bookings keep the day in `date` ("YYYY-MM-DD") and the time in `startTime` ("HH:MM", India time),
 * so the start moment is worked out from those two fields.
 */
export const sendSessionReminders = onSchedule('every 5 minutes', async () => {
  const db = admin.firestore();
  const now = Date.now();
  const days = [istDayKey(now), istDayKey(now + DAY_MS)];

  const dueWindow = (data: FirebaseFirestore.DocumentData) => {
    if (typeof data.date !== 'string' || typeof data.startTime !== 'string') return null;
    const minsLeft = (istMs(data.date, data.startTime) - now) / 60000;
    return REMINDER_WINDOWS.find(w => minsLeft >= w.fromMin && minsLeft < w.toMin && !data[w.flag]) ?? null;
  };

  // 1-to-1 and demo sessions
  const bookings = await db.collection('bookings').where('date', 'in', days).get();
  for (const d of bookings.docs) {
    const b = d.data();
    if (b.status !== 'confirmed') continue;
    const w = dueWindow(b);
    if (!w) continue;
    await d.ref.update({ [w.flag]: true }); // mark first so it is never sent twice
    const label = bookingLabel(b);
    await notifyBookingParties(
      b,
      'Session starting soon',
      `Your ${label} starts ${w.text}. Get ready to join.`,
      `Your ${label} with a student starts ${w.text}.`,
    );
  }

  // Audio group classes
  const classes = await db.collection('audioSessions').where('date', 'in', days).get();
  for (const d of classes.docs) {
    const s = d.data();
    if (s.status !== 'scheduled') continue;
    const w = dueWindow(s);
    if (!w) continue;
    await d.ref.update({ [w.flag]: true });

    const attendees = await d.ref.collection('attendees').get();
    await sendNotificationToUsers(
      attendees.docs.map(a => a.id),
      {
        type: 'audio',
        title: 'Class starting soon',
        body: `${clip(s.title, 60)} starts ${w.text}. Tap to join.`,
        targetScreen: 'VoiceRoomScreen',
        targetTab: 'official',
      },
    );
    const teacherUid = await getUidByEmail(typeof s.teacherEmail === 'string' ? s.teacherEmail : undefined);
    if (teacherUid) {
      await sendNotificationToUser(teacherUid, {
        type: 'audio',
        title: 'Your class starts soon',
        body: `"${clip(s.title, 60)}" starts ${w.text}.`,
        targetScreen: 'TeacherAudioSessionsScreen',
      }).catch(() => {});
    }
  }
});

// ═════════════════════════════════════════════
// STUDY / CLASS ROOMS
// ═════════════════════════════════════════════

/** A room was created -> tell everyone (once per creator per 10 minutes). */
export const onVoiceRoomCreated = onDocumentCreated(
  { document: 'voice_rooms/{roomId}', region: FIRESTORE_REGION },
  async event => {
    const room = event.data?.data();
    if (!room) return;
    const creator = typeof room.createdBy === 'string' ? room.createdBy : '';
    if (!(await acquireCooldown(`roomBroadcast_${creator || event.params.roomId}`, 10))) return;

    const isOfficial = room.type === 'official';
    const host = room.hostName ? `${room.hostName} started` : 'A new room started';
    await sendNotificationToAllUsers(
      {
        type: 'room',
        title: isOfficial ? 'Class room is live' : 'Study room is live',
        body: `${host}: ${clip(room.title, 60)}. Join now!`,
        targetRoomId: event.params.roomId,
      },
      creator || undefined,
    );
  },
);

// ═════════════════════════════════════════════
// COMMUNITY (feed and chat)
// ═════════════════════════════════════════════

/** Only an ADMIN's feed post is an announcement for everyone. Normal posts send nothing. */
export const onFeedPostCreated = onDocumentCreated(
  { document: 'posts/{postId}', region: FIRESTORE_REGION },
  async event => {
    const post = event.data?.data();
    if (!post || typeof post.uid !== 'string') return;
    if (!(await isAdminUid(post.uid))) return;
    await sendNotificationToAllUsers(
      {
        type: 'community',
        title: 'New announcement',
        body: clip(post.text, 110) || 'There is a new post in the community.',
        targetScreen: 'Dashboard',
        targetTab: 'Community',
      },
      post.uid,
    );
  },
);

const CHAT_PUSH_COOLDOWN_MINUTES = 5;

/**
 * New group chat message -> push to the other members.
 * To avoid spam: at most one push per group every 5 minutes, members who have the chat open
 * right now are skipped, and the push is not saved in the Notifications screen.
 */
export const onChatMessageCreated = onDocumentCreated(
  { document: 'community_groups/{groupId}/messages/{messageId}', region: FIRESTORE_REGION },
  async event => {
    const msg = event.data?.data();
    if (!msg || typeof msg.senderId !== 'string') return;
    const groupId = event.params.groupId;
    if (!(await acquireCooldown(`chatPush_${groupId}`, CHAT_PUSH_COOLDOWN_MINUTES))) return;

    const db = admin.firestore();
    const groupSnap = await db.collection('community_groups').doc(groupId).get();
    const groupTitle: string = groupSnap.data()?.title || 'Community chat';

    const preview =
      msg.type === 'image' ? '📷 Photo'
      : msg.type === 'file' ? `📄 ${clip(msg.fileName || 'File', 40)}`
      : msg.type === 'voice' ? '🎤 Voice note'
      : clip(msg.text, 90);

    const members = await db.collection('community_members').limit(1000).get();
    const now = Date.now();
    const uids: string[] = [];
    members.docs.forEach(m => {
      if (m.id === msg.senderId) return;
      const data = m.data();
      const lastActive = data.lastActive?.toMillis?.() ?? 0;
      const chatOpenNow = !!data.isChatActive && now - lastActive <= 90 * 1000;
      if (!chatOpenNow) uids.push(m.id);
    });
    if (uids.length === 0) return;

    await sendNotificationToUsers(uids, {
      type: 'community',
      title: groupTitle,
      body: `${msg.senderName || 'Someone'}: ${preview}`,
      targetScreen: 'Dashboard',
      targetTab: 'Community',
      pushOnly: true,
    });
  },
);

// ═════════════════════════════════════════════
// CHALLENGES
// ═════════════════════════════════════════════

/** New quiz challenge (collection "challenges") -> tell everyone. */
export const onChallengeCreated = onDocumentCreated(
  { document: 'challenges/{challengeId}', region: FIRESTORE_REGION },
  async event => {
    const c = event.data?.data();
    if (!c) return;
    await sendNotificationToAllUsers({
      type: 'challenge',
      title: 'New challenge is live',
      body: clip(c.title, 80) || 'A new challenge is waiting for you. Earn XP now!',
      targetScreen: 'Dashboard',
      targetTab: 'Community',
    });
  },
);

/** New daily challenge (collection "daily_challenges") -> tell everyone. */
export const onDailyChallengeCreated = onDocumentCreated(
  { document: 'daily_challenges/{challengeId}', region: FIRESTORE_REGION },
  async event => {
    const c = event.data?.data();
    if (!c) return;
    await sendNotificationToAllUsers({
      type: 'challenge',
      title: "Today's speaking challenge",
      body: clip(c.title, 80) || 'A new 60-second speaking challenge is ready. Try it now!',
      targetScreen: 'Dashboard',
      targetTab: 'Home',
    });
  },
);

// ═════════════════════════════════════════════
// STREAK
// ═════════════════════════════════════════════

// IMPORTANT: change these names if your Firestore data uses different ones
const STREAK_FIELD = 'streak'; // number field on users/{uid}
const LAST_PRACTICE_FIELD = 'lastPracticeDate'; // Timestamp or "YYYY-MM-DD" string on users/{uid} (optional)
const COMPLETED_DAYS_FIELD = 'completedLectureDates'; // array of "YYYY-MM-DD" on users/{uid} (the Home calendar uses it)

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

/**
 * Did this user practice today? true / false, or null when the data has no practice date at all
 * (then no reminder is sent, so nobody gets a wrong reminder).
 */
function practicedToday(user: FirebaseFirestore.DocumentData, today: string): boolean | null {
  const days = user[COMPLETED_DAYS_FIELD];
  const hasDays = Array.isArray(days);
  const lastDay = toDayKey(user[LAST_PRACTICE_FIELD]);
  if (!hasDays && lastDay === null) return null;
  return lastDay === today || (hasDays && days.includes(today));
}

/**
 * Runs every day at 8 PM India time. Reminds users who have an active streak
 * but have not practiced today yet.
 */
export const sendStreakReminders = onSchedule(
  { schedule: '0 20 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const today = istDayKey(Date.now());
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

      const due = snap.docs.filter(d => practicedToday(d.data(), today) === false);

      for (let i = 0; i < due.length; i += 25) {
        await Promise.allSettled(
          due.slice(i, i + 25).map(d =>
            sendNotificationToUser(d.id, {
              type: 'streak',
              title: 'Streak alert 🔥',
              body: `You're on a ${d.data()[STREAK_FIELD]}-day streak! Speak today to keep it alive.`,
              targetScreen: 'Dashboard',
              targetTab: 'Practice',
            }),
          ),
        );
      }

      last = snap.docs[snap.docs.length - 1];
    }
  },
);

/**
 * Runs when a user document changes:
 *  - streak reaches 3, 7, 14, 30, 60, 100, 200 or 365 days -> milestone notification
 *  - a streak of 3+ days falls back to 0                    -> "streak ended" notification
 * Most user updates (xp, tokens) do not touch the streak and return right away.
 */
export const onStreakChange = onDocumentUpdated(
  { document: 'users/{userId}', region: FIRESTORE_REGION },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const prev = Number(before[STREAK_FIELD]) || 0;
    const next = Number(after[STREAK_FIELD]) || 0;
    if (prev === next) return;
    const uid = event.params.userId;

    if (next > prev && STREAK_MILESTONES.includes(next)) {
      await sendNotificationToUser(uid, {
        type: 'streak',
        title: `${next}-day streak! 🔥`,
        body: `Amazing! You have practiced English ${next} days in a row. Keep going!`,
        targetScreen: 'Dashboard',
        targetTab: 'Home',
      });
    } else if (next === 0 && prev >= 3) {
      await sendNotificationToUser(uid, {
        type: 'streak',
        title: 'Your streak ended',
        body: `Your ${prev}-day streak has ended. Start a new one today, it only takes a minute.`,
        targetScreen: 'Dashboard',
        targetTab: 'Practice',
      });
    }
  },
);