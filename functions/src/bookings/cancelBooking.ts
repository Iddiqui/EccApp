import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * cancelBooking
 * -------------
 * Do cases me client isko call karega:
 *  1. Payment cancel/fail ho gaya (createBooking ke baad, verifyPayment se
 *     pehle) — slot ko wapas free karna hai, warna wo hamesha ke liye
 *     "booked" dikhta rahega bina kisi actual booking ke.
 *  2. User ne apni CONFIRMED booking cancel ki (refund policy alag se
 *     handle karni hogi, abhi sirf slot free karna + status update).
 *
 * Sirf apni khud ki booking cancel ki ja sakti hai (ownership check).
 *
 * 🎯 FIX (25 Sep 2026): pehle yahan `teachers` collection use ho rahi thi,
 * jab ke actual collection naam `session_teachers` hai (createBooking.ts
 * aur AdminSlotCreationScreen.tsx dono me isi naam se slots save/read hote
 * hain). Is mismatch ki wajah se slot ka document kabhi milta hi nahi tha
 * (`NOT_FOUND` error logs me), aur payment cancel/fail hone par slot
 * hamesha "booked" hi reh jaata tha — kabhi free nahi hota tha.
 */
export const cancelBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Login is required.'
    );
  }

  const { bookingId } = request.data || {};
  if (!bookingId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Booking is required.'
    );
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
        throw new functions.https.HttpsError(
          'permission-denied',
          'This booking is not yours.'
        );
      }

      if (booking.status === 'cancelled') {
        return; // already cancelled — idempotent, dobara kuch nahi karna
      }

      // 💳 Paid (confirmed) booking yahan se cancel nahi hogi. Refund flow abhi
      // bana nahi hai, aur bina refund ke slot free kar dene se student ka paisa
      // bhi jaata aur slot bhi kisi aur ko mil jaata. Tab tak support se hi hoga.
      if (booking.status === 'confirmed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'A confirmed session cannot be cancelled via the app. Please contact support.'
        );
      }

      // Slot ko wapas free karo — seedha slotId se reference karte hain
      if (booking.teacherId && booking.slotId) {
        const slotRef = db
          .collection('session_teachers')
          .doc(booking.teacherId)
          .collection('slots')
          .doc(booking.slotId);

        tx.update(slotRef, { isBooked: false });
      }

      tx.update(bookingRef, { status: 'cancelled' });
    });

    return { success: true };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    console.error('cancelBooking error:', err);
    throw new functions.https.HttpsError(
      'internal',
      'The booking could not be cancelled.'
    );
  }
});