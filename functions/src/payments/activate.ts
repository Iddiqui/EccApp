import * as admin from 'firebase-admin';
import { PLANS } from './pricing';

export interface ActivationResult {
  type: string;
  alreadyProcessed: boolean;
  expiresAt?: number; // epoch millis (sirf subscription)
  needsRefund?: boolean;
  refundReason?: string;
}

/**
 * Payment ko "paid" mark karna + entitlement dena, EK transaction me.
 * verifyPayment (app se) aur razorpayWebhook (Razorpay se) dono isi ko call
 * karte hain, isliye idempotent hai: dobara chalne par kuch double nahi hota.
 *
 * Returns null agar ye order hamare payments collection me hai hi nahi.
 *
 * one_to_one me edge cases (paisa kat gaya par booking ki halat badal gayi):
 *  - booking abhi bhi pending_payment → normal, confirmed.
 *  - booking cancelled ho gayi thi (app ne cleanup me slot free kar diya) par
 *    slot abhi bhi free hai → slot wapas lock karke booking confirm kar dete hain.
 *  - slot kisi aur ne le liya / booking already confirmed (duplicate payment) /
 *    booking gayab → payment "paid" rehta hai, needsRefund: true set hota hai.
 *    Refund Razorpay dashboard se manually karna hai.
 */
export async function activatePayment(
  orderId: string,
  gatewayPaymentId: string
): Promise<ActivationResult | null> {
  const db = admin.firestore();
  const payRef = db.collection('payments').doc(orderId);
  const { FieldValue, Timestamp } = admin.firestore;

  return db.runTransaction(async (tx) => {
    // ─── READS (saare reads, writes se pehle) ───
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) return null;
    const pay = paySnap.data()!;

    if (pay.status === 'paid') {
      return {
        type: pay.type,
        alreadyProcessed: true,
        expiresAt: pay.expiresAt?.toMillis?.(),
        needsRefund: !!pay.needsRefund,
        refundReason: pay.refundReason,
      };
    }

    // ═════════ SUBSCRIPTION ═════════
    if (pay.type === 'subscription') {
      const plan = PLANS[pay.planId];
      if (!plan) throw new Error(`Unknown plan on payment ${orderId}: ${pay.planId}`);

      const userRef = db.collection('users').doc(pay.userId);
      const userSnap = await tx.get(userRef);

      // Agar abhi active subscription hai to uske expiry ke upar extend karo
      const current = userSnap.data()?.subscription;
      const currentExpiry =
        current?.status === 'active' ? (current.expiresAt?.toMillis?.() ?? 0) : 0;
      const startMs = Math.max(Date.now(), currentExpiry);
      const expiresAt = Timestamp.fromMillis(startMs + plan.durationDays * 86400000);

      tx.update(payRef, {
        status: 'paid',
        gatewayPaymentId,
        verifiedAt: FieldValue.serverTimestamp(),
        expiresAt,
      });

      tx.set(
        userRef,
        {
          subscription: {
            status: 'active',
            planId: plan.id,
            startDate: FieldValue.serverTimestamp(),
            expiresAt,
            paymentId: gatewayPaymentId,
          },
        },
        { merge: true }
      );

      if (pay.couponCode) {
        tx.update(db.collection('coupons').doc(pay.couponCode), {
          usedCount: FieldValue.increment(1),
        });
      }

      return { type: pay.type, alreadyProcessed: false, expiresAt: expiresAt.toMillis() };
    }

    // ═════════ ONE_TO_ONE ═════════
    const bookingRef = pay.bookingId ? db.collection('bookings').doc(pay.bookingId) : null;
    const bookingSnap = bookingRef ? await tx.get(bookingRef) : null;
    const booking = bookingSnap?.exists ? bookingSnap.data()! : null;

    const slotRef =
      booking?.teacherId && booking?.slotId
        ? db
            .collection('teachers')
            .doc(booking.teacherId)
            .collection('slots')
            .doc(booking.slotId)
        : null;
    const slotSnap = slotRef ? await tx.get(slotRef) : null;

    let refundReason: string | null = null;
    let recoverSlot = false;

    if (!booking) {
      refundReason = 'booking_missing';
    } else if (booking.status === 'confirmed') {
      refundReason = 'duplicate_payment';
    } else if (booking.status === 'cancelled') {
      if (slotSnap?.exists && slotSnap.data()!.isBooked === false) {
        recoverSlot = true; // slot abhi bhi free hai, wapas lock kar sakte hain
      } else {
        refundReason = 'slot_no_longer_available';
      }
    }
    // booking.status === 'pending_payment' → normal flow

    // ─── WRITES ───
    if (refundReason) {
      tx.update(payRef, {
        status: 'paid',
        gatewayPaymentId,
        verifiedAt: FieldValue.serverTimestamp(),
        needsRefund: true,
        refundReason,
      });
      return {
        type: pay.type,
        alreadyProcessed: false,
        needsRefund: true,
        refundReason,
      };
    }

    tx.update(payRef, {
      status: 'paid',
      gatewayPaymentId,
      verifiedAt: FieldValue.serverTimestamp(),
    });
    if (recoverSlot && slotRef) tx.update(slotRef, { isBooked: true });
    tx.set(
      bookingRef!,
      { status: 'confirmed', paymentId: gatewayPaymentId },
      { merge: true }
    );

    return { type: pay.type, alreadyProcessed: false };
  });
}