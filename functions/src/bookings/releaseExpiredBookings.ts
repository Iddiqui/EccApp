import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// functions/src/bookings/releaseExpiredBookings.ts
//
// SAFETY NET: client-side cleanup (cancelBooking) best-effort hai. Agar app
// UPI app me jaate waqt band ho jaye, net chala jaye, ya cancelBooking fail
// ho jaye, to booking "pending_payment" me atak jaati hai aur slot
// isBooked:true reh jaata hai. Ye function har 5 minute me aisi purani
// bookings ko cancel karke slot wapas free kar deta hai.
//
// index.ts me export karna:
//   export { releaseExpiredBookings } from './bookings/releaseExpiredBookings';

const EXPIRY_MINUTES = 15; // isse zyada pending = abandoned
// payments doc ke ye status matlab "paisa nahi kata / kat ke wapas nahi gaya".
// Apne verifyPayment/webhook ke status names se match kar lena.
const NOT_PAID_STATUSES = ['created', 'failed', 'attempted'];

export const releaseExpiredBookings = onSchedule('every 5 minutes', async () => {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - EXPIRY_MINUTES * 60 * 1000);

  const stale = await db
    .collection('bookings')
    .where('status', '==', 'pending_payment')
    .where('createdAt', '<', cutoff)
    .limit(200)
    .get();

  for (const doc of stale.docs) {
    try {
      // Agar is booking ke liye koi payment paid/captured lag rahi hai to chhod do:
      // webhook / verifyPayment use confirm karega (ya refund karega).
      const pays = await db.collection('payments').where('bookingId', '==', doc.id).get();
      const maybePaid = pays.docs.some((p) => !NOT_PAID_STATUSES.includes(p.data().status));
      if (maybePaid) continue;

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists || fresh.data()!.status !== 'pending_payment') return;
        const b = fresh.data()!;
        const slotRef = db
          .collection('session_teachers')
          .doc(b.teacherId)
          .collection('slots')
          .doc(b.slotId);
        tx.update(doc.ref, {
          status: 'cancelled',
          cancelReason: 'payment_timeout',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(slotRef, { isBooked: false });
      });
    } catch (err) {
      console.error('releaseExpiredBookings: failed for', doc.id, err);
    }
  }
});