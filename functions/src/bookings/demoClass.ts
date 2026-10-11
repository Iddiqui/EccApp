import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// functions/src/bookings/demoClass.ts
//
// Demo (trial) class = ek student ke liye ek hi baar ka 1-to-1 video session.
// Existing slots + bookings + payment + video system hi use hota hai:
//   - booking par `kind: 'demo'` likha hota hai
//   - price Firestore `appConfig/demoClass` se aati hai (admin set karta hai)
//   - price 0 ho to demo free hai: booking seedha 'confirmed' ho jaati hai
//   - price >= 1 ho to booking 'pending_payment' me banti hai, phir wahi
//     createOrder (type 'one_to_one') + verifyPayment + getSessionToken flow
//
//  appConfig/demoClass = { price: number (rupees, 0 = free), isActive: boolean }
//  Config document nahi hai to demo band maana jaata hai.

interface DemoConfig {
  price: number;
  isActive: boolean;
}

async function loadDemoConfig(): Promise<DemoConfig> {
  const snap = await admin.firestore().doc('appConfig/demoClass').get();
  const d = snap.data();
  if (!snap.exists || !d || d.isActive !== true || !Number.isInteger(d.price) || d.price < 0) {
    return { price: 0, isActive: false };
  }
  return { price: d.price, isActive: true };
}

/** Student ke demo bookings: used = confirmed/completed, pending = payment baaki. */
async function loadMyDemoState(uid: string) {
  const snap = await admin
    .firestore()
    .collection('bookings')
    .where('studentId', '==', uid)
    .where('kind', '==', 'demo')
    .get();
  const live = snap.docs.filter((d) => d.data().status !== 'cancelled');
  const used = live.some((d) => ['confirmed', 'completed'].includes(d.data().status));
  const pending = live.find((d) => d.data().status === 'pending_payment') || null;
  return { used, pending };
}

/** Demo screen ke liye: price, available hai ya nahi, student ne pehle le liya ya nahi. */
export const getDemoConfig = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const [cfg, mine] = await Promise.all([loadDemoConfig(), loadMyDemoState(request.auth.uid)]);
  return { isActive: cfg.isActive, price: cfg.price, alreadyUsed: mine.used };
});

export const createDemoBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required to book a demo class.');
  }
  const { teacherId, slotId } = request.data || {};
  if (!teacherId || !slotId) {
    throw new functions.https.HttpsError('invalid-argument', 'teacherId and slotId are required.');
  }

  const uid: string = request.auth.uid;
  const db = admin.firestore();

  const cfg = await loadDemoConfig();
  if (!cfg.isActive) {
    throw new functions.https.HttpsError('failed-precondition', 'Demo classes are not available right now.');
  }
  const mine = await loadMyDemoState(uid);
  if (mine.used) {
    throw new functions.https.HttpsError('already-exists', 'You have already used your demo class.');
  }

  const teacherRef = db.collection('session_teachers').doc(teacherId);
  const slotRef = teacherRef.collection('slots').doc(slotId);
  const bookingRef = db.collection('bookings').doc();

  // Pehle se pending demo kisi aur slot par ho to use release karke naya banate hain
  const pendingDoc = mine.pending;
  const pendingData = pendingDoc?.data();
  const oldSlotRef =
    pendingData && pendingData.slotId !== slotId
      ? db.collection('session_teachers').doc(pendingData.teacherId).collection('slots').doc(pendingData.slotId)
      : null;

  try {
    const booking: Record<string, any> = await db.runTransaction(
      async (tx): Promise<Record<string, any>> => {
      const [teacherSnap, slotSnap, oldSlotSnap] = await Promise.all([
        tx.get(teacherRef),
        tx.get(slotRef),
        oldSlotRef ? tx.get(oldSlotRef) : Promise.resolve(null),
      ]);

      if (!teacherSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'This teacher was not found.');
      }
      if (!slotSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'This slot was not found.');
      }
      const teacher = teacherSnap.data()!;
      const slot = slotSnap.data()!;

      if (teacher.isActive === false) {
        throw new functions.https.HttpsError('failed-precondition', 'This teacher is not available.');
      }
      if (Array.isArray(teacher.modes) && !teacher.modes.includes('video')) {
        throw new functions.https.HttpsError('failed-precondition', 'This teacher does not take video sessions.');
      }
      if (!teacher.email) {
        throw new functions.https.HttpsError('failed-precondition', 'This teacher cannot be booked right now.');
      }

      // Retry: isi student ka pending demo isi slot par pehle se hai
      if (pendingDoc && pendingData && pendingData.slotId === slotId) {
        return { ...pendingData, id: pendingDoc.id };
      }

      if (slot.isBooked) {
        throw new functions.https.HttpsError('already-exists', 'This slot is already booked. Try another slot.');
      }
      const startMs = new Date(`${slot.date}T${slot.startTime}:00+05:30`).getTime();
      if (!isNaN(startMs) && startMs <= Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'This slot time has already passed.');
      }

      // Purana pending demo (kisi aur slot par) cancel + uska slot free
      if (pendingDoc && oldSlotRef) {
        tx.update(pendingDoc.ref, { status: 'cancelled', cancelReason: 'replaced_by_new_demo_booking' });
        if (oldSlotSnap && oldSlotSnap.exists) tx.update(oldSlotRef, { isBooked: false });
      }

      tx.update(slotRef, { isBooked: true });

      const status = cfg.price === 0 ? 'confirmed' : 'pending_payment';
      const newBooking = {
        kind: 'demo',
        studentId: uid,
        teacherId,
        teacherName: teacher.name,
        teacherEmail: String(teacher.email).toLowerCase(),
        slotId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: cfg.price,
        status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      tx.set(bookingRef, newBooking);
      return { ...newBooking, id: bookingRef.id };
      }
    );

    return {
      bookingId: booking.id,
      teacherId: booking.teacherId,
      teacherName: booking.teacherName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      price: booking.price,
      status: booking.status,
      kind: 'demo',
    };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('createDemoBooking error:', err);
    throw new functions.https.HttpsError('internal', 'The demo class could not be booked. Please try again.');
  }
});