import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * cancelBooking
 * -------------
 * The client calls this in these cases:
 *  1. Payment was cancelled / failed (after createBooking, before verifyPayment):
 *     the slot goes back to free.
 *  2. 🆕 A student cancels a CONFIRMED plan session (kind 'subscription') at least
 *     CANCEL_BEFORE_MIN minutes before it starts: the slot is freed AND the session is
 *     returned to the plan (remainingSessions +1, usedSessions -1).
 *
 * Paid (non-plan) confirmed bookings and demo classes still cannot be cancelled here:
 * there is no refund flow yet.
 *
 * Only your own booking can be cancelled (ownership check).
 */
const CANCEL_BEFORE_MIN = 120; // plan sessions can be cancelled up to 2 hours before the start

export const cancelBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }

  const { bookingId } = request.data || {};
  if (!bookingId) {
    throw new functions.https.HttpsError('invalid-argument', 'Booking is required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const bookingRef = db.collection('bookings').doc(bookingId);

  try {
    await db.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);

      if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Did not get a booking.');
      }

      const booking = bookingSnap.data()!;

      if (booking.studentId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'This booking is not yours.');
      }

      if (booking.status === 'cancelled') {
        return; // already cancelled: idempotent
      }

      const isPlanSession = booking.status === 'confirmed' && booking.kind === 'subscription';

      if (booking.status === 'confirmed' && !isPlanSession) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'A confirmed session cannot be cancelled via the app. Please contact support.'
        );
      }

      if (isPlanSession) {
        const startMs = new Date(`${booking.date}T${booking.startTime}:00+05:30`).getTime();
        if (!isNaN(startMs) && startMs - Date.now() < CANCEL_BEFORE_MIN * 60 * 1000) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Sessions can be cancelled up to 2 hours before the start time.'
          );
        }
      }

      // ── READS first ──
      const slotRef =
        booking.teacherId && booking.slotId
          ? db.collection('session_teachers').doc(booking.teacherId).collection('slots').doc(booking.slotId)
          : null;
      const slotSnap = slotRef ? await tx.get(slotRef) : null;

      const subRef =
        isPlanSession && booking.subscriptionId
          ? db.collection('subscriptions').doc(booking.subscriptionId)
          : null;
      const subSnap = subRef ? await tx.get(subRef) : null;

      // ── WRITES ──
      if (slotRef && slotSnap && slotSnap.exists) {
        tx.update(slotRef, { isBooked: false });
      }

      if (subRef && subSnap && subSnap.exists) {
        // Give the session back to the plan
        tx.update(subRef, {
          remainingSessions: admin.firestore.FieldValue.increment(1),
          usedSessions: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      tx.update(bookingRef, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    console.error('cancelBooking error:', err);
    throw new functions.https.HttpsError('internal', 'The booking could not be cancelled.');
  }
});