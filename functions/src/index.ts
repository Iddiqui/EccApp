import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';
import { getAccessStatus, getProgramAccess } from './payments/checkAccess';

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

// Sub-admins can also host official Class Rooms (same list the app reads).
async function isSubAdminEmail(email?: string): Promise<boolean> {
  if (!email) return false;
  const snap = await admin
    .firestore()
    .collection('sub_admins')
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
 *  - `room_<id>` (Study / Class Rooms): see below.
 *  - Baaki rooms: pehle jaisa, koi extra check nahi.
 */
async function assertCanJoinRoom(request: any, roomName: string) {
  const uid: string = request.auth.uid;
  const email: string | undefined = request.auth.token?.email;

  if (roomName.startsWith('session_')) {
    const bookingId = roomName.slice('session_'.length);
    const snap = await admin.firestore().collection('bookings').doc(bookingId).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Session not found.');
    }
    const booking = snap.data()!;

    const isStudent = booking.studentId === uid;
    const isTeacher =
      !!email &&
      typeof booking.teacherEmail === 'string' &&
      booking.teacherEmail.toLowerCase() === email.toLowerCase();

    if (!isStudent && !isTeacher) {
      throw new functions.https.HttpsError('permission-denied', 'This session does not belong to you.');
    }
    if (booking.status !== 'confirmed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This session is not confirmed (payment is pending or the booking was cancelled).'
      );
    }
    return;
  }

  // Voice rooms made in the app: livekit room name is `room_<voice_rooms doc id>`.
  //  - 'public' (Study Room): any logged-in user can join. Max 10 people is enforced by the app.
  //  - 'official' (Class Room): needs an active Audio plan (or the old Class Room plan),
  //    unless the user is an admin / sub-admin / the creator of the room.
  if (roomName.startsWith('room_')) {
    const roomId = roomName.slice('room_'.length);
    const snap = await admin.firestore().collection('voice_rooms').doc(roomId).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'This room is no longer available.');
    }
    const room = snap.data()!;
    if (room.type !== 'official') return; // public study room: login is enough

    if (room.createdBy === uid) return;
    if (await isHostEmail(email)) return;
    if (await isSubAdminEmail(email)) return;

    const [audio, legacy] = await Promise.all([
      getProgramAccess(uid, 'audio'),
      getAccessStatus(uid),
    ]);
    if (!audio.active && !legacy.hasAccess) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'An active Audio plan is required to join this Class Room.'
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
        'An active subscription is required to join this Class Room.'
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
export { checkClassRoomAccess, getMySubscriptions } from './payments/checkAccess';
// Video / Audio subscription plans (Firestore `subscriptionPlans`)
export {
  getProgramPlans,
  previewProgramPricing,
  seedProgramPlans,
} from './payments/programPlans';
export { createBooking } from './bookings/createBooking';
export { cancelBooking } from './bookings/cancelBooking';
export { submitReview } from './bookings/reviews';
export { createSubscriptionBooking } from './bookings/subscriptionBooking';
export {
  createAudioSession,
  cancelAudioSession,
  bookAudioSession,
  cancelAudioBooking,
  getAudioSessionToken,
} from './audio/audioSessions';
export { getSessionToken } from './bookings/getSessionToken';

export { releaseExpiredBookings } from './bookings/releaseExpiredBookings';
export {
  onBookingStatusChange,
  onSlotCreated,
  sendSessionReminders,
  sendStreakReminders,
} from './notifications/notificationTriggers';
export { getDemoConfig, createDemoBooking } from './bookings/demoClass';
export {
  adminSetDemoConfig, adminUpdatePlanPrice,
  adminUpsertTeacher, adminSetTeacherActive, adminDeleteTeacher,
} from './admin/adminTools';