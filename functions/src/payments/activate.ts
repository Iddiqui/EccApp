import * as admin from 'firebase-admin';
import { PLANS } from './pricing';

export interface ActivationResult {
  type: string;
  alreadyProcessed: boolean;
  expiresAt?: number; // epoch millis (sirf subscription)
  needsRefund?: boolean;
  refundReason?: string;
  program?: Record<string, any>; // 🆕 Video/Audio plan ka summary (success screen ke liye)
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
        program: pay.programSummary,
      };
    }

    // ═════════ PROGRAM (Video / Audio plan) ═════════
    if (pay.type === 'program') {
      const snap = pay.programSnapshot;
      if (!snap?.mode || !snap?.durationMonths) {
        throw new Error(`Program payment ${orderId} has no plan snapshot`);
      }

      const subRef = db.collection('subscriptions').doc(`${pay.userId}_${snap.mode}`);
      const subSnap = await tx.get(subRef);
      const cur = subSnap.data();
      const stillActive =
        cur?.status === 'active' && (cur.expiresAt?.toMillis?.() ?? 0) > Date.now();

      // Do tabs me do baar pay ho gaya: doosra payment refund hoga
      if (stillActive) {
        tx.update(payRef, {
          status: 'paid',
          gatewayPaymentId,
          verifiedAt: FieldValue.serverTimestamp(),
          needsRefund: true,
          refundReason: 'already_active',
        });
        return {
          type: pay.type,
          alreadyProcessed: false,
          needsRefund: true,
          refundReason: 'already_active',
        };
      }

      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + snap.durationMonths);
      const hasSessions = typeof snap.sessions === 'number';

      const programSummary = {
        mode: snap.mode,
        planName: snap.planName,
        durationLabel: snap.durationLabel,
        sessions: snap.sessions ?? null,
        sessionMins: snap.sessionMins ?? null,
        teacherName: snap.teacherName,
        startAt: start.getTime(),
        expiresAt: end.getTime(),
        remainingSessions: hasSessions ? snap.sessions : null,
      };

      tx.update(payRef, {
        status: 'paid',
        gatewayPaymentId,
        verifiedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(end),
        programSummary,
      });

      // subscriptions/{uid}_{mode}: SIRF server likhta hai (rules me client write band).
      tx.set(subRef, {
        userId: pay.userId,
        mode: snap.mode,
        status: 'active',
        planId: pay.planId,
        planName: snap.planName,
        durationMonths: snap.durationMonths,
        durationLabel: snap.durationLabel,
        sessionMins: snap.sessionMins ?? null,
        totalSessions: snap.sessions ?? null,
        usedSessions: hasSessions ? 0 : null,
        remainingSessions: hasSessions ? snap.sessions : null,
        teacherId: snap.teacherId,
        teacherName: snap.teacherName,
        teacherEmail: snap.teacherEmail,
        teacherPhotoUrl: snap.teacherPhotoUrl ?? null,
        startAt: Timestamp.fromDate(start),
        expiresAt: Timestamp.fromDate(end),
        orderId,
        paymentId: gatewayPaymentId,
        amountPaid: pay.amount,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (pay.couponCode) {
        tx.update(db.collection('coupons').doc(pay.couponCode), {
          usedCount: FieldValue.increment(1),
        });
      }

      return {
        type: pay.type,
        alreadyProcessed: false,
        expiresAt: end.getTime(),
        program: programSummary,
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
            .collection('session_teachers') // 🆕 FIX: pehle 'teachers' tha, slots yahan nahi hain
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