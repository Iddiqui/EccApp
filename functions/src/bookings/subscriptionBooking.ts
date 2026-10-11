import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// functions/src/bookings/subscriptionBooking.ts
//
// Video Mode: a student with an ACTIVE Video plan books a slot with their assigned
// teacher. No payment: one session is deducted from `subscriptions/{uid}_video`.
// Everything runs in ONE transaction, so two quick taps can never overspend sessions
// or double-book a slot.
//
//   subscriptions/{uid}_video.remainingSessions  -1
//   subscriptions/{uid}_video.usedSessions       +1
//   slot.isBooked                                true
//   bookings/{id}                                status 'confirmed', kind 'subscription'
//
// cancelBooking returns the session to the plan (see cancelBooking.ts).

export const createSubscriptionBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Please log in to book a session.');
  }
  const { teacherId, slotId } = request.data || {};
  if (!teacherId || !slotId) {
    throw new functions.https.HttpsError('invalid-argument', 'teacherId and slotId are required.');
  }

  const uid: string = request.auth.uid;
  const db = admin.firestore();
  const subRef = db.collection('subscriptions').doc(`${uid}_video`);
  const teacherRef = db.collection('session_teachers').doc(teacherId);
  const slotRef = teacherRef.collection('slots').doc(slotId);
  const bookingRef = db.collection('bookings').doc();

  try {
    const booking: Record<string, any> = await db.runTransaction(
      async (tx): Promise<Record<string, any>> => {
        const [subSnap, teacherSnap, slotSnap] = await Promise.all([
          tx.get(subRef),
          tx.get(teacherRef),
          tx.get(slotRef),
        ]);

        // ── Plan checks ──
        if (!subSnap.exists) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'You need an active Video plan to book a session.'
          );
        }
        const sub = subSnap.data()!;
        const expiresMs: number = sub.expiresAt?.toMillis?.() ?? 0;
        if (sub.status !== 'active' || expiresMs < Date.now()) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Your Video plan has expired. Please renew it to book sessions.'
          );
        }
        if (sub.teacherId !== teacherId) {
          throw new functions.https.HttpsError(
            'permission-denied',
            `Your plan is linked to ${sub.teacherName || 'your assigned teacher'}. You can only book slots with that teacher.`
          );
        }
        if ((sub.remainingSessions ?? 0) <= 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'You have used all sessions included in your current plan.'
          );
        }

        // ── Teacher + slot checks ──
        if (!teacherSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'This teacher was not found.');
        }
        if (!slotSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'This slot was not found.');
        }
        const teacher = teacherSnap.data()!;
        const slot = slotSnap.data()!;

        if (teacher.isActive === false) {
          throw new functions.https.HttpsError('failed-precondition', 'This teacher is not available.');
        }
        if (!teacher.email) {
          throw new functions.https.HttpsError('failed-precondition', 'This teacher cannot be booked right now.');
        }
        if (slot.isBooked) {
          throw new functions.https.HttpsError('already-exists', 'This slot is already booked. Try another slot.');
        }
        const startMs = new Date(`${slot.date}T${slot.startTime}:00+05:30`).getTime();
        if (!isNaN(startMs) && startMs <= Date.now()) {
          throw new functions.https.HttpsError('failed-precondition', 'This slot time has already passed.');
        }
        if (!isNaN(startMs) && startMs > expiresMs) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'This slot is after your plan expires. Please choose an earlier slot.'
          );
        }

        // ── Writes ──
        const { FieldValue } = admin.firestore;
        tx.update(subRef, {
          remainingSessions: FieldValue.increment(-1),
          usedSessions: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(slotRef, { isBooked: true });

        const newBooking = {
          kind: 'subscription',
          subscriptionId: subRef.id,
          studentId: uid,
          teacherId,
          teacherName: teacher.name,
          teacherEmail: String(teacher.email).toLowerCase(),
          slotId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: 0, // paid through the plan
          status: 'confirmed',
          createdAt: FieldValue.serverTimestamp(),
        };
        tx.set(bookingRef, newBooking);

        return {
          ...newBooking,
          id: bookingRef.id,
          remainingSessions: (sub.remainingSessions ?? 0) - 1,
        };
      }
    );

    return {
      bookingId: booking.id,
      teacherId: booking.teacherId,
      teacherName: booking.teacherName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      kind: 'subscription',
      remainingSessions: booking.remainingSessions,
    };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('createSubscriptionBooking error:', err);
    throw new functions.https.HttpsError('internal', 'The session could not be booked. Please try again.');
  }
});