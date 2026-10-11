import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { activatePayment } from './activate';

const REFUND_MESSAGES: Record<string, string> = {
  slot_no_longer_available:
    'We have received your payment, but this slot is no longer available. The money will be refunded within 5–7 working days.',
  duplicate_payment:
    'This booking has already been paid for. This extra payment will be refunded.',
  booking_missing:
    'We received your payment, but not the booking. The money will be refunded.',
  already_active:
    'Your plan for this mode is already active, so this extra payment will be refunded.',
};

/**
 * verifyPayment
 * -------------
 * Client bhejta hai: razorpay_order_id, razorpay_payment_id, razorpay_signature.
 * (bookingId ab bhi bheja ja sakta hai, lekin IGNORE hota hai. Booking wahi
 * hai jo createOrder ke waqt payment doc me save hui thi.)
 *
 * Signature check pehle jaisa, bas timing-safe. "paid" mark + subscription /
 * booking confirm ab activatePayment() me ek transaction me hota hai, aur
 * subscription ki duration plan se aati hai (pehle 30 din hard-coded thi).
 */
export const verifyPayment = functions.https.onCall(
  { secrets: ['RAZORPAY_KEY_SECRET'] },
  async (request: any) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.data || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Required fields for payment verification are missing.'
      );
    }

    // 🔐 Signature server pe dobara banao
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('Signature mismatch for order:', razorpay_order_id);
      throw new functions.https.HttpsError(
        'permission-denied',
        'The payment could not be verified. (signature mismatch).'
      );
    }

    // Ownership check: koi doosre user ka payment verify na kar sake
    const paymentSnap = await admin
      .firestore()
      .collection('payments')
      .doc(razorpay_order_id)
      .get();

    if (!paymentSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment record not found.');
    }
    if (paymentSnap.data()!.userId !== request.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'This payment is not yours.');
    }

    const result = await activatePayment(razorpay_order_id, razorpay_payment_id);
    if (!result) {
      throw new functions.https.HttpsError('not-found', 'Payment record not found.');
    }

    // Paisa aa gaya par booking confirm nahi ho sakti: user ko saaf batao.
    // (Payment doc me needsRefund: true save hai. Refund dashboard se karna hai.)
    if (result.needsRefund) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        REFUND_MESSAGES[result.refundReason || ''] ||
          'Payment received, but the booking could not be confirmed. The money will be refunded.'
      );
    }

    return { success: true, ...result };
  }
);