 import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';

// functions/src/bookings/getSessionToken.ts
//
// 1-to-1 session ka LiveKit token, SIRF booking ke student ya teacher ko.
// Room naam server khud banata hai (`session_<bookingId>`), client se nahi
// leta — isliye koi kisi aur ka room join nahi kar sakta.
//
// ⚠️ LIVEKIT_API_KEY / LIVEKIT_API_SECRET ke naam wahi rakho jo tumhare
// getLiveKitToken me use hote hain (secrets ya .env). Alag hon to yahan
// badal lena.
//
// index.ts me export:  export { getSessionToken } from './bookings/getSessionToken';

const JOIN_BEFORE_MIN = 15; // start se itne minute pehle se join
const JOIN_AFTER_END_MIN = 30; // end ke itne minute baad tak join

export const getSessionToken = functions.https.onCall(
  { secrets: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] },
  async (request: any) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
    }

    const { bookingId } = request.data || {};
    if (!bookingId || typeof bookingId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'bookingId is required.');
    }

    const uid: string = request.auth.uid;
    const email: string = String(request.auth.token?.email || '').toLowerCase();

    const snap = await admin.firestore().collection('bookings').doc(bookingId).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found.');
    }
    const booking = snap.data()!;

    if (booking.status !== 'confirmed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This session is not confirmed (payment pending or cancelled).'
      );
    }

    // Kaun hai: student (uid match) ya teacher (email match)
    const isStudent = booking.studentId === uid;
    const isTeacher =
      !!email && String(booking.teacherEmail || '').toLowerCase() === email;
    if (!isStudent && !isTeacher) {
      throw new functions.https.HttpsError('permission-denied', 'This session is not yours.');
    }

    // Time window (slots IST me bante hain)
    const startMs = new Date(`${booking.date}T${booking.startTime}:00+05:30`).getTime();
    const endMs = new Date(`${booking.date}T${booking.endTime}:00+05:30`).getTime();
    const now = Date.now();
    if (now < startMs - JOIN_BEFORE_MIN * 60000) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The session has not started yet. You can join a little while before it begins.'
      );
    }
    if (now > endMs + JOIN_AFTER_END_MIN * 60000) {
      throw new functions.https.HttpsError('failed-precondition', 'This session has ended.');
    }

    const roomName = `session_${bookingId}`;
    const displayName = isTeacher ? booking.teacherName || 'Teacher' : 'Student';

    const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
      identity: uid,
      name: displayName,
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true, // chat + emoji reactions
    });

    return { token: await at.toJwt(), roomName, role: isTeacher ? 'teacher' : 'student' };
  }
);