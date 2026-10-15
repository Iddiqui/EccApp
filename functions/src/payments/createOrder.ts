import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { computePricing } from './pricing';
import type { PricingBreakdown } from './pricing';
import {
  loadProgramPlan,
  loadApprovedTeacher,
  assertNoActiveProgram,
  computeProgramPricing,
} from './programPlans';
// razorpay npm package doesn't ship official TS types, isliye require() use kar rahe
// hain taaki TypeScript compile me dikkat na aaye.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

// NOTE: admin.initializeApp() index.ts me already call ho chuka hai.
// Yahan dobara call NAHI karna — dobara call karne se runtime error aata hai.

/**
 * createOrder
 * ------------
 * Client se aata hai: { type, planId?, couponCode?, bookingId?, teacherId? }
 * Client ka `amount` KAHIN use nahi hota.
 *
 *  - type 'subscription': Voice/ClassRoom plan. Price PLANS (pricing.ts) + coupon.
 *  - type 'one_to_one'  : bookingId zaroori. Price bookings/{bookingId}.price se.
 *  - type 'program'     : 🆕 Video/Audio plan. planId (subscriptionPlans doc) +
 *    teacherId zaroori. Price Firestore plan doc + coupon se server nikalta hai.
 *    Teacher approved + us mode ka hona chahiye, aur us mode ka plan pehle se
 *    active nahi hona chahiye.
 */
export const createOrder = functions.https.onCall(
  { secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] },
  async (request: any) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Please log in to make a payment.'
      );
    }

    const uid: string = request.auth.uid;
    const { type, planId, couponCode, bookingId, teacherId } = request.data || {};

    if (type !== 'subscription' && type !== 'one_to_one' && type !== 'program') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        "type must be 'subscription', 'one_to_one' or 'program'."
      );
    }

    let amountPaise: number;
    let pricing: PricingBreakdown | null = null;
    // program payment ke saath save hota hai, taaki baad me plan ki price/structure
    // badle to bhi jo user ne kharida wahi activate ho.
    let programSnapshot: Record<string, any> | null = null;

    if (type === 'subscription') {
      pricing = await computePricing(planId, couponCode);
      amountPaise = pricing.payablePaise;
    } else if (type === 'program') {
      const plan = await loadProgramPlan(planId);
      // Audio (group classes) has no personal teacher; only Video (1:1) needs one.
      const teacher = plan.mode === 'video' ? await loadApprovedTeacher(teacherId, plan.mode) : null;
      await assertNoActiveProgram(uid, plan.mode);
      pricing = await computeProgramPricing(plan, couponCode);
      amountPaise = pricing.payablePaise;
      programSnapshot = {
        mode: plan.mode,
        planName: pricing.planName,
        durationMonths: plan.durationMonths,
        durationLabel: plan.durationLabel,
        sessions: plan.sessions,
        sessionMins: plan.sessionMins,
        teacherId: teacher?.id ?? null,
        teacherName: teacher?.name ?? null,
        teacherEmail: teacher?.email ?? null,
        teacherPhotoUrl: teacher?.photoUrl ?? null,
      };
    } else {
      if (!bookingId || typeof bookingId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'bookingId is required.');
      }
      const bookingSnap = await admin.firestore().collection('bookings').doc(bookingId).get();
      if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Booking not found.');
      }
      const booking = bookingSnap.data()!;

      if (booking.studentId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'This booking does not belong to you.');
      }
      if (booking.status !== 'pending_payment') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This booking is no longer available for payment.'
        );
      }
      if (typeof booking.price !== 'number' || booking.price < 1) {
        console.error('Booking price invalid:', bookingId, booking.price);
        throw new functions.https.HttpsError('internal', 'The booking price is not valid.');
      }
      amountPaise = Math.round(booking.price * 100);
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const receipt = `rcpt_${Date.now()}_${uid.slice(0, 12)}`;

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise, // paise
        currency: 'INR',
        receipt,
        notes: {
          userId: uid,
          type,
          planId: planId || '',
          bookingId: bookingId || '',
          teacherId: programSnapshot?.teacherId || '',
          couponCode: pricing?.couponCode ?? '',
        },
      });

      await admin.firestore().collection('payments').doc(order.id).set({
        paymentId: order.id,
        userId: uid,
        type,
        planId: type === 'subscription' || type === 'program' ? planId : null,
        bookingId: type === 'one_to_one' ? bookingId : null,
        teacherId: programSnapshot?.teacherId ?? null,
        programSnapshot,
        couponCode: pricing?.couponCode ?? null,
        pricing,
        amount: amountPaise / 100,
        currency: 'INR',
        gateway: 'razorpay',
        gatewayOrderId: order.id,
        status: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        // Key ID PUBLIC hai (checkout SDK ko chahiye). Key SECRET kabhi client ko nahi jaata.
        keyId: process.env.RAZORPAY_KEY_ID,
        pricing,
      };
    } catch (err: any) {
      console.error('createOrder error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Could not create the payment order. Please try again.'
      );
    }
  }
);