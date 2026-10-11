import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * submitReview
 * ------------
 * A student rates a finished 1-to-1 session (1-5 stars + optional comment).
 *  - Only the student of that booking can review it, and only once.
 *  - The session must be confirmed and already over (end time passed, IST).
 *  - Teacher rating = average of all reviews. Everything is calculated here, in one
 *    transaction. The app can never write ratings (Firestore rules block it).
 *
 * Save as: functions/src/bookings/reviews.ts
 */
export const submitReview = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const uid: string = request.auth.uid;
  const { bookingId, rating, comment } = request.data || {};

  if (typeof bookingId !== 'string' || !bookingId) {
    throw new functions.https.HttpsError('invalid-argument', 'Booking is required.');
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new functions.https.HttpsError('invalid-argument', 'Please choose 1 to 5 stars.');
  }
  const cleanComment =
    typeof comment === 'string' ? comment.trim().slice(0, 300) : '';

  const db = admin.firestore();
  const bookingRef = db.collection('bookings').doc(bookingId);

  await db.runTransaction(async (tx) => {
    const bSnap = await tx.get(bookingRef);
    if (!bSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Session not found.');
    }
    const b = bSnap.data()!;
    if (b.studentId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'This session is not yours.');
    }
    if (b.status !== 'confirmed') {
      throw new functions.https.HttpsError('failed-precondition', 'Only completed sessions can be rated.');
    }
    if (b.reviewed === true) {
      throw new functions.https.HttpsError('already-exists', 'You have already rated this session.');
    }
    // Session end time is IST (+05:30)
    const endMs = new Date(`${b.date}T${b.endTime}:00+05:30`).getTime();
    if (!Number.isFinite(endMs) || endMs > Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'You can rate a session after it ends.');
    }
    if (!b.teacherId) {
      throw new functions.https.HttpsError('failed-precondition', 'This session has no teacher to rate.');
    }

    const teacherRef = db.collection('session_teachers').doc(b.teacherId);
    const reviewRef = teacherRef.collection('reviews').doc(bookingId);
    const tSnap = await tx.get(teacherRef);
    if (!tSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Teacher not found.');
    }
    const t = tSnap.data()!;
    const oldCount: number = Number.isFinite(t.ratingCount) ? t.ratingCount : 0;
    const oldSum: number = Number.isFinite(t.ratingSum)
      ? t.ratingSum
      : Math.round((Number(t.rating) || 0) * oldCount);
    const newCount = oldCount + 1;
    const newSum = oldSum + rating;

    tx.set(reviewRef, {
      bookingId,
      studentId: uid,
      studentName: (request.auth.token?.name as string) || 'Student',
      rating,
      comment: cleanComment,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(teacherRef, {
      ratingCount: newCount,
      ratingSum: newSum,
      rating: Math.round((newSum / newCount) * 10) / 10,
    });
    tx.update(bookingRef, { reviewed: true, reviewRating: rating });
  });

  return { success: true };
});