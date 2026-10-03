import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { computePricing } from './pricing';
import type { PricingBreakdown } from './pricing';
// razorpay npm package doesn't ship official TS types, isliye require() use kar rahe
// hain taaki TypeScript compile me dikkat na aaye.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

// NOTE: admin.initializeApp() index.ts me already call ho chuka hai.
// Yahan dobara call NAHI karna — dobara call karne se runtime error aata hai.

/**
 * createOrder
 * ------------
 * Client se aata hai: { type, planId?, couponCode?, bookingId? }
 * Client ka `amount` ab KAHIN use nahi hota (pehle hota tha, aur usse koi bhi
 * ₹1 me subscription/session khareed sakta tha).
 *
 *  - type 'subscription': price PLANS (pricing.ts) + coupon se server nikalta hai.
 *  - type 'one_to_one'  : bookingId zaroori. Price bookings/{bookingId}.price se
 *    aata hai (jo createBooking ne teacher.pricePerSession se server pe likha).
 *    Booking student ki apni honi chahiye aur status 'pending_payment' hona chahiye.
 */
export const createOrder = functions.https.onCall(
  { secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] },
  async (request: any) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Login is required for payment.'
      );
    }

    const uid: string = request.auth.uid;
    const { type, planId, couponCode, bookingId } = request.data || {};

    if (type !== 'subscription' && type !== 'one_to_one') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        "The type can only be 'subscription' or 'one-to-one'."
      );
    }

    let amountPaise: number;
    let pricing: PricingBreakdown | null = null;

    if (type === 'subscription') {
      pricing = await computePricing(planId, couponCode);
      amountPaise = pricing.payablePaise;
    } else {
      if (!bookingId || typeof bookingId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Booking is required.');
      }
      const bookingSnap = await admin.firestore().collection('bookings').doc(bookingId).get();
      if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Did not get a booking.');
      }
      const booking = bookingSnap.data()!;

      if (booking.studentId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'This booking is not yours.');
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
          couponCode: pricing?.couponCode ?? '',
        },
      });

      await admin.firestore().collection('payments').doc(order.id).set({
        paymentId: order.id,
        userId: uid,
        type,
        planId: type === 'subscription' ? planId : null,
        bookingId: type === 'one_to_one' ? bookingId : null,
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
        'The payment order could not be created. Please try again.'
      );
    }
  }
);