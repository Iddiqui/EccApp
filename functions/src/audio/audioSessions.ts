import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';
import { getProgramAccess } from '../payments/checkAccess';

// functions/src/audio/audioSessions.ts
//
// Audio Mode = GROUP classes. One scheduled session = ONE LiveKit room (`audio_<sessionId>`).
//
//   audioSessions/{id} = {
//     teacherId, teacherEmail, teacherName, title, description,
//     date 'YYYY-MM-DD', startTime 'HH:MM', endTime 'HH:MM', durationMins,
//     maxParticipants, bookedCount, roomName, status 'scheduled' | 'cancelled', createdAt
//   }
//   audioSessions/{id}/attendees/{uid} = { studentId, studentName, bookedAt }
//
// Teachers create sessions; students with an ACTIVE Audio plan (linked to the SAME teacher)
// book a seat. Only a booked student, or the teacher who owns the session, gets a room token.
// All writes go through these functions (Firestore rules block client writes).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const JOIN_BEFORE_MIN = 15;
const JOIN_AFTER_END_MIN = 30;
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).getTime();
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const err = (code: functions.https.FunctionsErrorCode, msg: string) =>
  new functions.https.HttpsError(code, msg);

function requireAuth(request: any) {
  if (!request.auth) throw err('unauthenticated', 'Please log in.');
}

/** The logged-in user must be an approved, active teacher who teaches Audio. */
async function loadMyAudioTeacher(request: any) {
  const email = String(request.auth.token?.email || '');
  if (!email) throw err('permission-denied', 'Teacher access is required.');
  const snap = await admin
    .firestore()
    .collection('session_teachers')
    .where('email', 'in', Array.from(new Set([email, email.toLowerCase()])))
    .limit(1)
    .get();
  if (snap.empty) throw err('permission-denied', 'Teacher access is required.');
  const doc = snap.docs[0];
  const t = doc.data();
  if (t.isActive === false) throw err('permission-denied', 'Your teacher access is switched off.');
  if (Array.isArray(t.modes) && !t.modes.includes('audio')) {
    throw err('permission-denied', 'You are not approved for Audio Mode.');
  }
  return { id: doc.id, data: t };
}

export const createAudioSession = functions.https.onCall(async (request: any) => {
  requireAuth(request);
  const teacher = await loadMyAudioTeacher(request);

  const { title, description, date, startTime, durationMins, maxParticipants } = request.data || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 80) throw err('invalid-argument', 'Enter a title (up to 80 characters).');
  if (typeof date !== 'string' || !DATE_RE.test(date)) throw err('invalid-argument', 'Choose a valid date.');
  if (typeof startTime !== 'string' || !TIME_RE.test(startTime)) throw err('invalid-argument', 'Choose a valid start time.');
  const dur = Number(durationMins);
  if (!Number.isInteger(dur) || dur < 15 || dur > 180) throw err('invalid-argument', 'Duration must be between 15 and 180 minutes.');
  const max = maxParticipants === undefined ? 50 : Number(maxParticipants);
  if (!Number.isInteger(max) || max < 1 || max > 200) throw err('invalid-argument', 'Maximum participants must be between 1 and 200.');

  const startMs = ist(date, startTime);
  if (isNaN(startMs) || startMs <= Date.now()) throw err('failed-precondition', 'The session must start in the future.');
  const startMin = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const endMin = startMin + dur;
  if (endMin >= 24 * 60) throw err('invalid-argument', 'The session must end before midnight.');
  const endTime = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

  const ref = admin.firestore().collection('audioSessions').doc();
  await ref.set({
    teacherId: teacher.id,
    teacherEmail: String(teacher.data.email).toLowerCase(),
    teacherName: teacher.data.name || 'Teacher',
    title: title.trim(),
    description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    date,
    startTime,
    endTime,
    durationMins: dur,
    maxParticipants: max,
    bookedCount: 0,
    roomName: `audio_${ref.id}`,
    status: 'scheduled',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sessionId: ref.id };
});

export const cancelAudioSession = functions.https.onCall(async (request: any) => {
  requireAuth(request);
  const teacher = await loadMyAudioTeacher(request);
  const { sessionId } = request.data || {};
  if (!sessionId) throw err('invalid-argument', 'sessionId is required.');
  const ref = admin.firestore().collection('audioSessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) throw err('not-found', 'Session not found.');
  if (snap.data()!.teacherId !== teacher.id) throw err('permission-denied', 'This session is not yours.');
  await ref.update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

/** A student reserves a seat. Needs an active Audio plan with THIS session's teacher. */
export const bookAudioSession = functions.https.onCall(async (request: any) => {
  requireAuth(request);
  const uid: string = request.auth.uid;
  const { sessionId } = request.data || {};
  if (!sessionId) throw err('invalid-argument', 'sessionId is required.');

  const access = await getProgramAccess(uid, 'audio');
  if (!access.active) {
    throw err(
      'failed-precondition',
      access.reason === 'expired'
        ? 'Your Audio plan has expired. Please renew it to join classes.'
        : 'You need an active Audio plan to join group classes.'
    );
  }

  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(uid).get();
  const studentName: string =
    userSnap.data()?.fullName || request.auth.token?.name || String(request.auth.token?.email || 'Student').split('@')[0];

  const sessionRef = db.collection('audioSessions').doc(sessionId);
  const attendeeRef = sessionRef.collection('attendees').doc(uid);

  await db.runTransaction(async (tx) => {
    const [sSnap, aSnap] = await Promise.all([tx.get(sessionRef), tx.get(attendeeRef)]);
    if (!sSnap.exists) throw err('not-found', 'Session not found.');
    const s = sSnap.data()!;
    if (s.status !== 'scheduled') throw err('failed-precondition', 'This session was cancelled.');
    if (s.teacherId !== access.teacherId) {
      throw err('permission-denied', `Your plan is linked to ${access.teacherName || 'your assigned teacher'}. You can only join their classes.`);
    }
    if (ist(s.date, s.endTime) <= Date.now()) throw err('failed-precondition', 'This session has already ended.');
    if (aSnap.exists) return; // already booked
    if (access.expiresAt && ist(s.date, s.startTime) > access.expiresAt) {
      throw err('failed-precondition', 'This session is after your plan expires.');
    }
    if ((s.bookedCount ?? 0) >= s.maxParticipants) throw err('failed-precondition', 'This session is full.');

    tx.set(attendeeRef, {
      studentId: uid,
      studentName,
      bookedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(sessionRef, { bookedCount: admin.firestore.FieldValue.increment(1) });
  });
  return { success: true };
});

export const cancelAudioBooking = functions.https.onCall(async (request: any) => {
  requireAuth(request);
  const uid: string = request.auth.uid;
  const { sessionId } = request.data || {};
  if (!sessionId) throw err('invalid-argument', 'sessionId is required.');

  const db = admin.firestore();
  const sessionRef = db.collection('audioSessions').doc(sessionId);
  const attendeeRef = sessionRef.collection('attendees').doc(uid);

  await db.runTransaction(async (tx) => {
    const [sSnap, aSnap] = await Promise.all([tx.get(sessionRef), tx.get(attendeeRef)]);
    if (!sSnap.exists || !aSnap.exists) return;
    const s = sSnap.data()!;
    if (ist(s.date, s.startTime) - Date.now() < 15 * 60 * 1000) {
      throw err('failed-precondition', 'You can cancel up to 15 minutes before the class starts.');
    }
    tx.delete(attendeeRef);
    tx.update(sessionRef, { bookedCount: admin.firestore.FieldValue.increment(-1) });
  });
  return { success: true };
});

/** Room token: the owning teacher (host) or a booked student with an active Audio plan. */
export const getAudioSessionToken = functions.https.onCall(
  { secrets: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] },
  async (request: any) => {
    requireAuth(request);
    const uid: string = request.auth.uid;
    const email = String(request.auth.token?.email || '').toLowerCase();
    const { sessionId } = request.data || {};
    if (!sessionId) throw err('invalid-argument', 'sessionId is required.');

    const db = admin.firestore();
    const sSnap = await db.collection('audioSessions').doc(sessionId).get();
    if (!sSnap.exists) throw err('not-found', 'Session not found.');
    const s = sSnap.data()!;
    if (s.status !== 'scheduled') throw err('failed-precondition', 'This session was cancelled.');

    const isHost = !!email && String(s.teacherEmail).toLowerCase() === email;
    let displayName = s.teacherName || 'Teacher';

    if (!isHost) {
      const access = await getProgramAccess(uid, 'audio');
      if (!access.active) throw err('failed-precondition', 'You need an active Audio plan to join.');
      const a = await db.collection('audioSessions').doc(sessionId).collection('attendees').doc(uid).get();
      if (!a.exists) throw err('permission-denied', 'Please book a seat for this class first.');
      displayName = a.data()?.studentName || 'Student';
    }

    const startMs = ist(s.date, s.startTime);
    const endMs = ist(s.date, s.endTime);
    const now = Date.now();
    if (now < startMs - JOIN_BEFORE_MIN * 60000) {
      throw err('failed-precondition', 'The class has not started yet. You can join shortly before the start time.');
    }
    if (now > endMs + JOIN_AFTER_END_MIN * 60000) throw err('failed-precondition', 'This class has ended.');

    const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
      identity: uid,
      name: displayName,
      ttl: '3h',
    });
    at.addGrant({
      roomJoin: true,
      room: s.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost, // the teacher can mute / remove participants
    });
    return { token: await at.toJwt(), roomName: s.roomName, role: isHost ? 'host' : 'student' };
  }
);