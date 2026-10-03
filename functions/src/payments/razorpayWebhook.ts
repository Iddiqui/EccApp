import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { activatePayment } from './activate';

/**
 * razorpayWebhook
 * ---------------
 * Agar user payment karke app band kar de, ya verifyPayment ke waqt network
 * chala jaye, tab bhi Razorpay is URL ko call karta hai aur subscription /
 * booking activate ho jaati hai. activatePayment() idempotent hai, isliye
 * verifyPayment ke saath double-processing ka koi khatra nahi.
 *
 * Razorpay dashboard → Settings → Webhooks:
 *   URL    : deploy ke baad terminal me jo URL dikhe
 *   Secret : wahi jo RAZORPAY_WEBHOOK_SECRET me set kiya
 *   Events : payment.captured, order.paid
 */
export const razorpayWebhook = functions.https.onRequest(
  { secrets: ['RAZORPAY_WEBHOOK_SECRET'] },
  async (req: any, res: any) => {
    const signature = req.header('x-razorpay-signature');

    if (req.method !== 'POST' || !signature || !req.rawBody) {
      res.status(400).send('bad request');
      return;
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(req.rawBody) // raw body chahiye, parsed JSON nahi
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(400).send('invalid signature');
      return;
    }

    const evt = req.body;
    if (evt?.event === 'payment.captured' || evt?.event === 'order.paid') {
      const payment = evt.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        try {
          await activatePayment(payment.order_id, payment.id);
        } catch (e) {
          console.error('webhook activate failed', e);
          res.status(500).send('retry'); // Razorpay dobara bhejega
          return;
        }
      }
    }

    res.status(200).send('ok');
  }
);