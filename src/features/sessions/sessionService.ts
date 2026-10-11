import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import { payWithRazorpay } from '../payments/paymentService';
import type { PayMethod } from '../payments/paymentTypes';
import type {
  Teacher,
  TimeSlot,
  Booking,
  CreateBookingParams,
  CreateBookingResponse,
} from './sessionTypes';

// 🆕 TEACHER PROFILE REVIEWS
// NOTE: `Review` type yahan locally define kiya hai kyunki `sessionTypes.ts`
// me abhi ye nahi hai — agar chaho to ise wahan move kar sakte ho for
// consistency. Reviews `session_teachers/{teacherId}/reviews/{reviewId}`
// me store hote hain. Abhi sirf READ side bana hai (profile screen par
// dikhane ke liye) — review LIKHNE ka flow (jaise session complete hone
// ke baad student se rating maangna) ek alag future feature hoga.
export interface Review {
  id: string;
  studentName: string;
  rating: number; // 1-5
  comment: string;
  createdAt?: any; // Firestore Timestamp
}

export const getTeacherReviews = async (teacherId: string): Promise<Review[]> => {
  const snap = await firestore()
    .collection('session_teachers')
    .doc(teacherId)
    .collection('reviews')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Review));
};

// 🆕 LOCAL date key ("YYYY-MM-DD"). toISOString() UTC deta hai, isliye India me
// raat 12 se subah 5:30 tak "aaj" ki jagah kal ki date aa jaati thi.
export const localDateKey = (d: Date = new Date()): string => {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 🆕 Slot ka start time nikal chuka ho to wo student ko nahi dikhta.
export const isSlotPast = (slot: { date: string; startTime: string }): boolean =>
  new Date(`${slot.date}T${slot.startTime}:00`).getTime() <= Date.now();

// ─── READ-ONLY FETCHES (seedha Firestore se — client SDK se safe hai,
// Firestore Rules me sirf "read" allow karna, "write" nahi) ───

export const getTeachers = async (): Promise<Teacher[]> => {
  const snap = await firestore().collection('session_teachers').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Teacher));
};

export const getTeacherById = async (teacherId: string): Promise<Teacher | null> => {
  const doc = await firestore().collection('session_teachers').doc(teacherId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Teacher;
};

export const getAvailableSlots = async (
  teacherId: string,
  date?: string // "YYYY-MM-DD", optional filter
): Promise<TimeSlot[]> => {
  let query = firestore()
    .collection('session_teachers')
    .doc(teacherId)
    .collection('slots')
    .where('isBooked', '==', false)
    .orderBy('date')
    .orderBy('startTime');

  if (date) {
    query = firestore()
      .collection('session_teachers')
      .doc(teacherId)
      .collection('slots')
      .where('isBooked', '==', false)
      .where('date', '==', date)
      .orderBy('startTime');
  }

  const snap = await query.get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as TimeSlot))
    .filter((slot) => !isSlotPast(slot)); // 🆕 purane slots screen se hat jaate hain
};

// 🆕 SAB TEACHERS KE OPEN SLOTS EK SAATH (Home screen "Book 1-1 Session"
// card + "See all" ke liye) — student ko ab pehle teacher choose karne ki
// zaroorat nahi, seedha koi bhi open slot dekh kar tap-to-book kar sakta
// hai. Firestore me har teacher ke slots uske apne document ke andar ek
// subcollection me hain (`session_teachers/{teacherId}/slots`) — inhe EK
// SAATH query karne ke liye Firestore ka COLLECTION GROUP query use karte
// hain (`collectionGroup('slots')`), jo naam-matching sabhi subcollections
// ko ek saath padhta hai, chahe wo kisi bhi parent document ke andar ho.
//
// ⚠️ Agar pehli baar chalane par ek "query requires an index" error aaye,
// Firestore khud ek clickable link deta hai jo missing composite index
// (isBooked + date + startTime, collection group scope me) ek click me
// bana deta hai.
export interface OpenSlot extends TimeSlot {
  teacherId: string;
  teacherName: string;
  teacherPricePerSession: number;
  teacherPhotoUrl?: string;
}

export const getAllAvailableSlots = async (): Promise<OpenSlot[]> => {
  const [slotsSnap, teachers] = await Promise.all([
    firestore()
      .collectionGroup('slots')
      .where('isBooked', '==', false)
      .orderBy('date')
      .orderBy('startTime')
      .get(),
    getTeachers(),
  ]);

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  return slotsSnap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const teacher = teacherMap.get(data.teacherId);
      // Agar teacher document delete ho chuka ho ya na mile, ye slot skip
      // kar dete hain (orphaned data — UI me confusing rahega warna).
      if (!teacher) return null;
      return {
        id: doc.id,
        ...data,
        teacherId: data.teacherId,
        teacherName: teacher.name,
        // 🆕 Slot ki apni price (admin ne set ki). Purane slots me na ho to
        // teacher ki price. teacherPricePerSession ko bhi yahi value di hai
        // taaki jo screens is field se ₹ dikhati hain wo bina change ke
        // sahi slot price dikhayein.
        price: typeof data.price === 'number' ? data.price : teacher.pricePerSession,
        teacherPricePerSession:
          typeof data.price === 'number' ? data.price : teacher.pricePerSession,
        teacherPhotoUrl: teacher.photoUrl,
      } as OpenSlot;
    })
    .filter((s): s is OpenSlot => s !== null)
    .filter((s) => !isSlotPast(s)); // 🆕 purane slots screen se hat jaate hain
};

// ─── RAW CLOUD FUNCTION CALLS ───

const createBooking = async (
  params: CreateBookingParams
): Promise<CreateBookingResponse> => {
  const callable = functions().httpsCallable('createBooking');
  const result = await callable(params);
  return result.data as CreateBookingResponse;
};

// 🆕 Demo (trial) class: ek student ka ek hi baar. Price admin ke appConfig/demoClass se.
const createDemoBooking = async (
  params: CreateBookingParams
): Promise<CreateBookingResponse> => {
  const callable = functions().httpsCallable('createDemoBooking');
  const result = await callable(params);
  return result.data as CreateBookingResponse;
};

export interface DemoConfig {
  isActive: boolean;
  price: number; // rupees, 0 = free
  alreadyUsed: boolean;
}

export const getDemoConfig = async (): Promise<DemoConfig> => {
  const callable = functions().httpsCallable('getDemoConfig');
  const result = await callable({});
  return result.data as DemoConfig;
};

// 🆕 Video plan: book a slot with the assigned teacher. No payment; one plan session is used.
export interface SubscriptionBookingResult {
  bookingId: string;
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  kind: 'subscription';
  remainingSessions: number;
}

export const bookSubscriptionSession = async (
  params: CreateBookingParams
): Promise<SubscriptionBookingResult> => {
  const callable = functions().httpsCallable('createSubscriptionBooking');
  const result = await callable(params);
  return result.data as SubscriptionBookingResult;
};

// ─── 🆕 AUDIO GROUP CLASSES (audioSessions collection; all writes go through functions) ───
export interface AudioSession {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  title: string;
  description: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;
  durationMins: number;
  maxParticipants: number;
  bookedCount: number;
  roomName: string;
  status: 'scheduled' | 'cancelled';
}

const audioCall = async (fn: string, payload: any) => {
  const result = await functions().httpsCallable(fn)(payload);
  return result.data as any;
};

export const createAudioSession = (p: {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  durationMins: number;
  maxParticipants?: number;
}) => audioCall('createAudioSession', p) as Promise<{ sessionId: string }>;

export const cancelAudioSession = (sessionId: string) => audioCall('cancelAudioSession', { sessionId });
export const bookAudioSession = (sessionId: string) => audioCall('bookAudioSession', { sessionId });
export const cancelAudioBooking = (sessionId: string) => audioCall('cancelAudioBooking', { sessionId });
export const getAudioSessionToken = (sessionId: string) =>
  audioCall('getAudioSessionToken', { sessionId }) as Promise<{ token: string; roomName: string; role: 'host' | 'student' }>;

/** Upcoming (not yet ended, not cancelled) group sessions of ONE teacher. */
export const getAudioSessionsForTeacher = async (teacherId: string): Promise<AudioSession[]> => {
  const snap = await firestore().collection('audioSessions').where('teacherId', '==', teacherId).get();
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as AudioSession))
    .filter((x) => x.status === 'scheduled' && new Date(`${x.date}T${x.endTime}:00`).getTime() > now)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
};

/** Which of these sessions has the current student booked? (own attendee doc per session) */
export const getMyAudioBookingIds = async (sessionIds: string[]): Promise<Set<string>> => {
  const uid = auth().currentUser?.uid;
  const ids = new Set<string>();
  if (!uid) return ids;
  await Promise.all(
    sessionIds.map(async (id) => {
      const doc = await firestore().collection('audioSessions').doc(id).collection('attendees').doc(uid).get();
      if (doc.exists) ids.add(id);
    })
  );
  return ids;
};

export const getAudioAttendees = async (sessionId: string): Promise<{ id: string; studentName: string }[]> => {
  const snap = await firestore().collection('audioSessions').doc(sessionId).collection('attendees').get();
  return snap.docs.map((d) => ({ id: d.id, studentName: (d.data() as any).studentName || 'Student' }));
};

/**
 * Join the room of an audio session.
 * The server checks everything (host or booked student with an active plan, time window)
 * and returns a LiveKit token for room `audio_<sessionId>`.
 * ⚠️ Connecting that token to the app's existing room screen is wired in the next step,
 * once the room screen / CallSessionProvider files are shared.
 */
export const joinAudioRoom = async (session: AudioSession) => {
  const data = await getAudioSessionToken(session.id);
  return { serverUrl: LIVEKIT_SERVER_URL, token: data.token, roomName: data.roomName, role: data.role };
};

export const cancelBooking = async (bookingId: string): Promise<{ success: boolean }> => {
  const callable = functions().httpsCallable('cancelBooking');
  const result = await callable({ bookingId });
  return result.data as { success: boolean };
};

// ─── MAIN ENTRY POINT — poora booking + payment flow ek hi function me ───
// Screens sirf isko call karenge:
//
//   const result = await bookAndPaySession({ teacherId, slotId });
//   if (result.success) { ... booking confirmed ... }
//
// Flow:
//   1. createBooking()     → slot atomically reserve hota hai (transaction)
//   2. payWithRazorpay()   → user payment karta hai (checkout + verify)
//   3. Agar payment fail/cancel ho jaye → cancelBooking() se slot wapas
//      free kar dete hain, taaki wo permanently "booked" na reh jaye
export const bookAndPaySession = async (
  params: CreateBookingParams,
  method?: PayMethod, // 🆕 payment screen par user ne jo method chuna (upi/card/netbanking/wallet)
  kind: 'regular' | 'demo' = 'regular' // 🆕 'demo' = ek-baar ka demo class (price admin config se)
): Promise<{ success: boolean; bookingId: string }> => {
  // Step 1 — slot reserve karo (server pe, race-condition-safe)
  const booking =
    kind === 'demo' ? await createDemoBooking(params) : await createBooking(params);

  // Free demo class: server ne booking seedha confirm kar di, payment ki zaroorat nahi
  if (booking.status === 'confirmed') {
    return { success: true, bookingId: booking.bookingId };
  }

  try {
    // Step 2 — payment karo
    // Amount app se nahi jaata. Server booking doc se price nikalta hai.
    const result = await payWithRazorpay({
      type: 'one_to_one',
      bookingId: booking.bookingId,
      method,
    });

    return { success: result.success, bookingId: booking.bookingId };
  } catch (err: any) {
    // Payment fail/cancel hui — slot ko wapas free karo taaki koi aur
    // student use book kar sake. Cancel-release best-effort hai — agar ye
    // bhi fail ho jaye to booking "pending_payment" hi reh jaayegi (koi
    // access nahi milega, bas slot thodi der ke liye locked reh sakta hai).
    //
    // ⚠️ Lekin agar PAISA KAT CHUKA hai (err.paymentTaken: verify ke waqt network
    // gaya, ya refund case) to slot free MAT karo. Webhook booking confirm kar
    // dega, warna slot kisi aur ko mil jaata aur student ka paisa bhi jaata.
    if (!err?.paymentTaken) {
      // 🆕 3 baar try: network blip par ek hi call fail hone se slot atka na rahe.
      // Phir bhi fail ho to server ka releaseExpiredBookings 15 min me free kar dega.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await cancelBooking(booking.bookingId);
          break;
        } catch (cancelErr) {
          console.error(`cancelBooking (cleanup) failed, attempt ${attempt + 1}:`, cancelErr);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }

    throw err; // original payment error ko upar screen tak propagate karo
  }
};

// ─── UPCOMING SESSIONS (Home screen ke "Upcoming Sessions" card ke liye) ───

// STUDENT side — bookings jahan MAIN student hoon
export const getMyUpcomingSessionsAsStudent = async (): Promise<Booking[]> => {
  const uid = auth().currentUser?.uid;
  if (!uid) return [];

  const todayStr = localDateKey(); // "YYYY-MM-DD"

  const snap = await firestore()
    .collection('bookings')
    .where('studentId', '==', uid)
    .where('status', '==', 'confirmed')
    .where('date', '>=', todayStr)
    .orderBy('date')
    .orderBy('startTime')
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Booking));
};

// TEACHER side — bookings jahan MAIN teacher hoon (jinhe padhana hai)
// 🎯 UID pe depend NAHI karta — EMAIL se match karta hai (jaisa aapke
// `admins` collection ka pattern hai). Isliye teachers collection ka
// document ID kuch bhi ho (random ya UID), koi farak nahi padta — bas
// teacher document me `email` field sahi honi chahiye.
export const getMyUpcomingSessionsAsTeacher = async (): Promise<Booking[]> => {
  const email = auth().currentUser?.email;
  if (!email) return [];

  const todayStr = localDateKey();

  const snap = await firestore()
    .collection('bookings')
    .where('teacherEmail', '==', email)
    .where('status', '==', 'confirmed')
    .where('date', '>=', todayStr)
    .orderBy('date')
    .orderBy('startTime')
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Booking));
};

// Convenience — current logged-in user "host/admin" (matlab teacher) hai
// ya nahi, ye `admins` collection me email match karke check karta hai —
// bilkul wahi pattern jo Study Room/Class Room host detection me already
// use ho raha hai. HomeScreen ye decide karne ke liye use karega ki
// student-side ya teacher-side "Upcoming Sessions" query chalani hai.
// Admins: email is in the `admins` collection (Admin Panel is for these users only).
export const checkIsAdmin = async (): Promise<boolean> => {
  const email = auth().currentUser?.email;
  if (!email) return false;

  const snap = await firestore()
    .collection('admins')
    .where('email', '==', email)
    .limit(1)
    .get();

  return !snap.empty;
};

// 🆕 Teachers: the email belongs to an ACTIVE `session_teachers` document.
// Only an admin can create that document (Admin Panel > Teachers), so a normal
// student can never become a teacher by logging in.
export const getMyTeacherProfile = async (): Promise<Teacher | null> => {
  const email = auth().currentUser?.email;
  if (!email) return null;

  const emails = Array.from(new Set([email, email.toLowerCase()]));
  const snap = await firestore()
    .collection('session_teachers')
    .where('email', 'in', emails)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as any;
  if (data.isActive === false) return null;
  return { id: doc.id, ...data } as Teacher;
};

// "Host" = anyone who teaches / runs sessions: an admin OR an approved teacher.
// HomeScreen and the sessions list use this to show the teacher-side view.
export const checkIsHost = async (): Promise<boolean> => {
  const [admin, teacher] = await Promise.all([checkIsAdmin(), getMyTeacherProfile()]);
  return admin || !!teacher;
};

// ─── JOIN SESSION (student aur teacher, dono isी EK function ko call
// karenge — sirf `booking` object alag hoga) ───
//
// ⚠️ Apni LiveKit server URL yahan daalo (jahan bhi aapne
// VoiceRoomScreen/ClassRoomScreen me pehle se define kar rakha hai, wahi
// value copy karo — dono jagah SAME honi chahiye).
// (Ye tumhare Metro logs se liya hai. Ek baar VoiceRoomScreen wali value se verify kar lena.)
const LIVEKIT_SERVER_URL = 'wss://eccapp-4hmra95b.livekit.cloud';

export const joinVideoSession = async (
  booking: Booking
): Promise<{
  serverUrl: string;
  token: string;
  otherPersonName: string;
  bookingId: string;
}> => {
  const email = auth().currentUser?.email;
  const isTeacher = !!email && email === booking.teacherEmail;

  // 🆕 Token ab SERVER se booking ke basis par aata hai (student ya teacher
  // hone ka check + time window). Room naam server khud `session_<bookingId>`
  // banata hai. Room LiveKit par pehle banda join karte hi auto-create hota hai.
  const callable = functions().httpsCallable('getSessionToken');
  const result = await callable({ bookingId: booking.id });
  const { token } = result.data as { token: string };

  return {
    serverUrl: LIVEKIT_SERVER_URL,
    token,
    // VideoSessionScreen ko "doosra banda kaun hai" dikhana hota hai —
    // agar main teacher hoon to doosra banda student hai (uska naam abhi
    // booking me store nahi hota, sirf uid) — agar main student hoon to
    // doosra banda teacher hai (uska naam booking.teacherName me hai).
    otherPersonName: isTeacher ? 'Student' : booking.teacherName,
    bookingId: booking.id,
  };
};