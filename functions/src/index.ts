import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';
import { getAccessStatus } from './payments/checkAccess';

admin.initializeApp();

/**
 * Class Rooms ke roomName ke prefixes (jis format se ClassRoomScreen token
 * maangti hai, e.g. 'classroom_'). Jin rooms ka naam in prefixes se shuru
 * hota hai unme sirf ACTIVE SUBSCRIPTION wale students (aur admins/hosts)
 * ja sakte hain.
 *
 * ⚠️ Abhi khaali hai, matlab class rooms ka server-side gate OFF hai.
 * Study/Voice rooms free hain to unke prefixes yahan mat daalna.
 */
const CLASS_ROOM_PREFIXES: string[] = [];

async function isHostEmail(email?: string): Promise<boolean> {
  if (!email) return false;
  const snap = await admin
    .firestore()
    .collection('admins')
    .where('email', '==', email)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Room join ka server-side check.
 *  - `session_<bookingId>` (1 to 1): sirf usi booking ka student ya teacher,
 *    aur booking 'confirmed' honi chahiye (yaani payment ho chuka).
 *  - CLASS_ROOM_PREFIXES wale rooms: active subscription (ya host).
 *  - Baaki rooms: pehle jaisa, koi extra check nahi.
 */
async function assertCanJoinRoom(request: any, roomName: string) {
  const uid: string = request.auth.uid;
  const email: string | undefined = request.auth.token?.email;

  if (roomName.startsWith('session_')) {
    const bookingId = roomName.slice('session_'.length);
    const snap = await admin.firestore().collection('bookings').doc(bookingId).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Session nahi mila.');
    }
    const booking = snap.data()!;

    const isStudent = booking.studentId === uid;
    const isTeacher =
      !!email &&
      typeof booking.teacherEmail === 'string' &&
      booking.teacherEmail.toLowerCase() === email.toLowerCase();

    if (!isStudent && !isTeacher) {
      throw new functions.https.HttpsError('permission-denied', 'Ye session aapka nahi hai.');
    }
    if (booking.status !== 'confirmed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Ye session confirmed nahi hai (payment pending ya cancelled).'
      );
    }
    return;
  }

  if (CLASS_ROOM_PREFIXES.some((p) => roomName.startsWith(p))) {
    if (await isHostEmail(email)) return;
    const access = await getAccessStatus(uid);
    if (!access.hasAccess) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Class Room join karne ke liye active subscription chahiye.'
      );
    }
  }
}

// LiveKit keys ab code me nahi, Secret Manager me:
//   firebase functions:secrets:set LIVEKIT_API_KEY
//   firebase functions:secrets:set LIVEKIT_API_SECRET
export const getLiveKitToken = functions.https.onCall(
  { secrets: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] },
  async (request: any) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be logged in to join the room.'
      );
    }

    const { roomName, participantName } = request.data || {};

    if (!roomName || !participantName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'roomName and participantName are required.'
      );
    }

    await assertCanJoinRoom(request, String(roomName));

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY as string,
      process.env.LIVEKIT_API_SECRET as string,
      { identity: participantName, ttl: '2h' }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return { token };
  }
);

export { createOrder } from './payments/createOrder';
export { verifyPayment } from './payments/verifyPayment';
export { getPlans, previewPricing } from './payments/previewPricing';
export { razorpayWebhook } from './payments/razorpayWebhook';
export { checkClassRoomAccess } from './payments/checkAccess';
export { createBooking } from './bookings/createBooking';
export { cancelBooking } from './bookings/cancelBooking';
export { getSessionToken } from './bookings/getSessionToken';

export { releaseExpiredBookings } from './bookings/releaseExpiredBookings';
export {
  onBookingStatusChange,
  onSlotCreated,
  sendSessionReminders,
  sendStreakReminders,
} from './notifications/notificationTriggers';