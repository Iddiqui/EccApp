import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * createBooking  (PHASE 3: ab Video subscription se chalta hai)
 * -------------------------------------------------------------
 * Student apne Video plan ke teacher ka ek slot book karta hai. Ab har slot
 * ka alag payment nahi hota. Plan kharidte waqt hi paisa de diya gaya hai,
 * isliye yahan:
 *  1. subscriptions/{uid}_video dekha jaata hai: plan active ho, expire na
 *     hua ho, aur remainingSessions > 0 ho.
 *  2. Teacher wahi hona chahiye jo plan kharidte waqt lock hua tha.
 *  3. Ek hi TRANSACTION mein: slot lock hota hai, subscription ka count ek
 *     ghatta hai (remainingSessions -1, usedSessions +1) aur booking seedha
 *     'confirmed' status mein ban jaati hai (price 0, payment screen nahi).
 *
 * Transaction isliye zaroori hai ki 2 students ek saath same slot par tap
 * karein, ya ek student ek saath 2 baar tap kare, to bhi sirf ek hi booking
 * bane aur count sirf ek baar ghate.
 *
 * Demo class is function se nahi, createDemoBooking se chalti hai (alag).
 *
 * Collection name `session_teachers` hi hai (website ka `teachers` alag hai).
 */

/** Firestore Timestamp / Date / number / ISO string, sab ko milliseconds mein badalta hai. */
function toMillis(v: any): number {
  if (!v) return NaN;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return new Date(v).getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return NaN;
}

export const createBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Logging in is required for booking.'
    );
  }

  const { teacherId, slotId } = request.data || {};

  if (!teacherId || !slotId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'teacherId and slotId are essential.'
    );
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const teacherRef = db.collection('session_teachers').doc(teacherId);
  const slotRef = teacherRef.collection('slots').doc(slotId);
  const subRef = db.collection('subscriptions').doc(`${uid}_video`);
  const bookingRef = db.collection('bookings').doc(); // naya auto-id

  try {
    const result = await db.runTransaction(async (tx) => {
      // Firestore transaction mein saari reads pehle, writes baad mein.
      const [teacherSnap, slotSnap, subSnap] = await Promise.all([
        tx.get(teacherRef),
        tx.get(slotRef),
        tx.get(subRef),
      ]);

      if (!teacherSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'I could not find a teacher.');
      }
      if (!slotSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Did not get a slot.');
      }

      const slot = slotSnap.data()!;

      // RETRY / DOUBLE-TAP SAFE: agar ye slot pehle se isi student ki booking
      // se locked hai (double tap, ya app beech mein band ho gayi), to wahi
      // booking wapas do. Naya count nahi ghatta.
      if (slot.isBooked) {
        const mineQuery = db
          .collection('bookings')
          .where('slotId', '==', slotId)
          .where('studentId', '==', uid)
          .limit(5);
        const mineSnap = await tx.get(mineQuery);
        const existing = mineSnap.docs.find((d) => {
          const s = d.data().status;
          return s === 'confirmed' || s === 'pending_payment';
        });
        if (existing) {
          return {
            ...(existing.data() as any),
            id: existing.id,
            remainingSessions: Number(subSnap.data()?.remainingSessions ?? 0),
          };
        }
        throw new functions.https.HttpsError(
          'already-exists',
          'This slot is already booked. Try another slot.'
        );
      }

      // ---- Teacher checks ----
      const teacher = teacherSnap.data()!;

      if (teacher.isActive === false) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This teacher is not available right now.'
        );
      }
      if (Array.isArray(teacher.modes) && !teacher.modes.includes('video')) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This teacher does not take Video sessions.'
        );
      }
      if (!teacher.email) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          "The email is missing from the teacher's profile. This teacher cannot be booked right now."
        );
      }

      // ---- Subscription checks ----
      if (!subSnap.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'You need an active Video plan to book a session. Please buy a plan first.'
        );
      }
      const sub = subSnap.data()!;

      if (sub.status && sub.status !== 'active') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Your Video plan is not active.'
        );
      }

      const expiresMs = toMillis(sub.expiresAt);
      if (isNaN(expiresMs) || expiresMs <= Date.now()) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Your Video plan has expired. Please buy a new plan.'
        );
      }

      // Teacher lock: plan kharidte waqt jo teacher chuna tha, sirf wahi.
      if (sub.teacherId !== teacherId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Your plan is locked to a different teacher. You can book slots only with your own teacher.'
        );
      }

      const remaining = Number(sub.remainingSessions);
      if (!(remaining > 0)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'You have used all sessions included in your current plan.'
        );
      }

      // ---- Slot time checks (slots IST mein bante hain, isliye +05:30) ----
      const slotStartMs = new Date(`${slot.date}T${slot.startTime}:00+05:30`).getTime();
      if (!isNaN(slotStartMs)) {
        if (slotStartMs <= Date.now()) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'This slot time has already passed. Please choose another slot.'
          );
        }
        if (slotStartMs > expiresMs) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'This slot is after your plan expires. Please choose an earlier slot.'
          );
        }
      }

      // ---- Writes ----
      const usedBefore = Number(sub.usedSessions) || 0;

      // Slot lock
      tx.update(slotRef, { isBooked: true });

      // Session count ek ghatao
      tx.update(subRef, {
        usedSessions: usedBefore + 1,
        remainingSessions: remaining - 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const newBooking = {
        studentId: uid,
        teacherId,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        slotId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: 0, // paisa plan kharidte waqt de diya gaya
        status: 'confirmed',
        kind: 'subscription',
        subscriptionId: subRef.id,
        planId: sub.planId ?? null,
        sessionCounted: true, // cancel par count sirf ek baar wapas aaye
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      tx.set(bookingRef, newBooking);

      return { ...newBooking, id: bookingRef.id, remainingSessions: remaining - 1 };
    });

    return {
      bookingId: result.id,
      teacherId: result.teacherId,
      teacherName: result.teacherName,
      date: result.date,
      startTime: result.startTime,
      endTime: result.endTime,
      price: result.price,
      status: result.status,
      kind: result.kind,
      remainingSessions: result.remainingSessions,
    };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    console.error('createBooking error:', err);
    throw new functions.https.HttpsError(
      'internal',
      'The booking could not be created. Please try again.'
    );
  }
});