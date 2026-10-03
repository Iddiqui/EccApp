import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * createBooking
 * -------------
 * Student ek teacher ka ek slot select karta hai. Ye function:
 *  1. User authenticated hai ya nahi check karta hai
 *  2. Teacher + slot document exist karte hain ya nahi check karta hai
 *  3. Firestore TRANSACTION me: slot ko "isBooked" check karta hai —
 *     agar already booked hai to error de deta hai, WARNA usi transaction
 *     ke andar slot ko turant isBooked=true kar deta hai aur ek
 *     "pending_payment" booking bana deta hai.
 *
 * 🎯 TRANSACTION kyun zaroori hai: agar 2 students EK SATH same slot pe tap
 * karein, bina transaction ke dono ka booking ban sakta tha (race
 * condition). Transaction guarantee karta hai ki sirf EK hi student
 * successfully book kar paayega, doosre ko turant "already booked" error
 * milega.
 *
 * Payment abhi nahi hua — booking status "pending_payment" rehta hai jab
 * tak client `payWithRazorpay()` se payment complete karke verifyPayment
 * ko bookingId nahi bhejta (verifyPayment.ts status ko "confirmed" karta
 * hai).
 *
 * 🎯 COLLECTION NAME: `session_teachers` collection use hota hai (naaki
 * `teachers`), kyunki `teachers` naam WEBSITE apne coaches ke liye already
 * use kar raha hai — alag data shape ke saath. Client-side files
 * (sessionService.ts, AdminSlotCreationScreen.tsx) me bhi isi collection
 * naam se match karna zaroori hai.
 */
export const createBooking = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Logging in is required for booking.'
    );
  }

  const { teacherId, slotId } = request.data || {};

  if (!teacherId || !slotId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'teacherId and slotId are essential.'
    );
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const teacherRef = db.collection('session_teachers').doc(teacherId);
  const slotRef = teacherRef.collection('slots').doc(slotId);
  const bookingRef = db.collection('bookings').doc(); // naya auto-id

  try {
    const bookingData = await db.runTransaction(async (tx) => {
      const [teacherSnap, slotSnap] = await Promise.all([
        tx.get(teacherRef),
        tx.get(slotRef),
      ]);

      if (!teacherSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'I could not find a teacher.');
      }
      if (!slotSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Did not get a slot.');
      }

      const slot = slotSnap.data()!;
      if (slot.isBooked) {
        // 🆕 RETRY SAFE: agar ye slot isi student ki pehle se "pending_payment"
        // booking se locked hai (pichli payment fail/cancel hui aur cleanup
        // nahi chala, ya app beech me band ho gayi), to naya booking banane
        // ki jagah wahi booking wapas de do. Warna student ko "slot already
        // booked" dikhta aur slot list se gayab ho jaata.
        const mineQuery = db
          .collection('bookings')
          .where('slotId', '==', slotId)
          .where('studentId', '==', uid)
          .where('status', '==', 'pending_payment')
          .limit(1);
        const mineSnap = await tx.get(mineQuery);
        if (!mineSnap.empty) {
          const existing = mineSnap.docs[0];
          return { ...(existing.data() as any), id: existing.id };
        }
        throw new functions.https.HttpsError(
          'already-exists',
          'This slot is already booked. Try another slot.'
        );
      }

      // 🆕 Guzar chuka slot book nahi hoga (slots IST me banaye jaate hain, isliye +05:30)
      const slotStartMs = new Date(`${slot.date}T${slot.startTime}:00+05:30`).getTime();
      if (!isNaN(slotStartMs) && slotStartMs <= Date.now()) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This slot time has already passed. Please choose another slot.'
        );
      }

      const teacher = teacherSnap.data()!;

      if (!teacher.email) {
        // Isse pehle hi pakड़ lena behtar hai deploy-time se pehle —
        // teacher document me email field na hone se teacher-side "meri
        // sessions" query kabhi kaam nahi karegi.
        throw new functions.https.HttpsError(
          'failed-precondition',
          "The email is missing from the teacher's profile. This teacher cannot be booked right now."
        );
      }

      // 🔒 Isी transaction ke andar slot ko turant lock kar dete hain —
      // koi doosra parallel request ab isko book nahi kar sakega.
      tx.update(slotRef, { isBooked: true });

      // 🆕 PRICE: pehle slot ki apni price (admin ne set ki), warna purane
      // slots ke liye teacher.pricePerSession. Booking me copy ho jaati hai,
      // isliye baad me admin price badle to bhi is booking ki price wahi
      // rahegi jo student ne dekhi thi. createOrder booking.price se hi
      // amount banata hai, wahan koi change nahi chahiye.
      const price =
        typeof slot.price === 'number' && slot.price >= 1
          ? slot.price
          : teacher.pricePerSession;

      const newBooking = {
        studentId: uid,
        teacherId,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        slotId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price,
        status: 'pending_payment',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      tx.set(bookingRef, newBooking);

      return { ...newBooking, id: bookingRef.id };
    });

    return {
      bookingId: bookingData.id,
      teacherId: bookingData.teacherId,
      teacherName: bookingData.teacherName,
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      price: bookingData.price,
    };
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    console.error('createBooking error:', err);
    throw new functions.https.HttpsError(
      'internal',
      'The booking could not be created. Please try again.'
    );
  }
});