import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { assertAdmin } from '../payments/programPlans';

// functions/src/admin/adminTools.ts
//
// Admin ke sab sensitive kaam callables se hote hain (admin SDK), client se seedha
// Firestore me nahi. Har function pehle `assertAdmin` chalata hai: sirf wahi user
// jiska email `admins` collection me hai.

const MODES = ['video', 'audio'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bad = (msg: string) => new functions.https.HttpsError('invalid-argument', msg);

/** Demo class ki price (rupees, 0 = free) aur on/off. */
export const adminSetDemoConfig = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { price, isActive } = request.data || {};
  if (!Number.isInteger(price) || price < 0 || price > 100000) {
    throw bad('Price must be a whole number of rupees between 0 and 100000 (0 means free).');
  }
  await admin
    .firestore()
    .doc('appConfig/demoClass')
    .set(
      { price, isActive: isActive !== false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  return { success: true };
});

/** Subscription plan ki price (aur active/inactive). Sessions/duration yahan se nahi badalte. */
export const adminUpdatePlanPrice = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { planId, price, isActive } = request.data || {};
  if (typeof planId !== 'string' || !planId) throw bad('planId is required.');
  const update: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (price !== undefined) {
    if (!Number.isInteger(price) || price < 1 || price > 1000000) {
      throw bad('Price must be a whole number of rupees between 1 and 1000000.');
    }
    update.price = price;
  }
  if (isActive !== undefined) update.isActive = !!isActive;

  const ref = admin.firestore().collection('subscriptionPlans').doc(planId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'This plan does not exist.');
  // A plan can be active only with a valid price
  const finalPrice = update.price !== undefined ? update.price : snap.data()!.price;
  const finalActive = update.isActive !== undefined ? update.isActive : snap.data()!.isActive !== false;
  if (finalActive && !(Number.isInteger(finalPrice) && finalPrice >= 1)) {
    throw bad('Set a price of at least ₹1 before activating this plan.');
  }
  await ref.update(update); // purchased plans par asar nahi: unka snapshot payment me save hai
  return { success: true };
});

/** Teacher add / update. Sirf approved emails ko teacher access milta hai. */
export const adminUpsertTeacher = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { teacherId, name, email, modes, isActive } = request.data || {};

  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw bad('Enter the teacher name.');
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw bad('Enter a valid email address.');
  if (!Array.isArray(modes) || !modes.length || !modes.every((m: any) => MODES.includes(m))) {
    throw bad("Choose at least one mode ('video' and/or 'audio').");
  }
  const cleanEmail = email.trim().toLowerCase();

  const db = admin.firestore();
  const dup = await db.collection('session_teachers').where('email', '==', cleanEmail).limit(2).get();
  if (dup.docs.some((d) => d.id !== teacherId)) {
    throw new functions.https.HttpsError('already-exists', 'A teacher with this email already exists.');
  }

  const base = {
    name: name.trim(),
    email: cleanEmail,
    modes,
    isActive: isActive !== false,
    role: 'teacher',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (teacherId) {
    const ref = db.collection('session_teachers').doc(teacherId);
    if (!(await ref.get()).exists) throw new functions.https.HttpsError('not-found', 'Teacher not found.');
    await ref.update(base);
    return { teacherId };
  }

  const ref = await db.collection('session_teachers').add({
    ...base,
    specialization: '', // teacher khud bharega
    pricePerSession: 500, // sirf purane slots ke fallback ke liye
    sessionDurationMins: 30,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { teacherId: ref.id };
});

export const adminSetTeacherActive = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { teacherId, isActive } = request.data || {};
  if (typeof teacherId !== 'string' || !teacherId || typeof isActive !== 'boolean') {
    throw bad('teacherId and isActive are required.');
  }
  await admin
    .firestore()
    .collection('session_teachers')
    .doc(teacherId)
    .update({ isActive, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

/** Teacher access delete (profile + slots). Upcoming confirmed sessions ho to block: pehle deactivate karo. */
export const adminDeleteTeacher = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { teacherId } = request.data || {};
  if (typeof teacherId !== 'string' || !teacherId) throw bad('teacherId is required.');

  const db = admin.firestore();
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST date
  const upcoming = await db
    .collection('bookings')
    .where('teacherId', '==', teacherId)
    .where('status', '==', 'confirmed')
    .get();
  if (upcoming.docs.some((d) => String(d.data().date) >= today)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This teacher has upcoming sessions. Deactivate the teacher instead, or delete after the sessions are done.'
    );
  }
  await db.recursiveDelete(db.collection('session_teachers').doc(teacherId));
  return { success: true };
});