import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { resolveCoupon, buildBreakdown } from './pricing';
import type { PricingBreakdown } from './pricing';

/**
 * Video / Audio "program" plans
 * -----------------------------
 * Plans ka EK hi sach: Firestore `subscriptionPlans/{planId}`.
 * Admin sirf `price` (aur `isActive`) badal sakta hai. Sessions, duration,
 * sessionMins structure fixed rehta hai.
 *
 *  subscriptionPlans/{planId} = {
 *    mode: 'video' | 'audio',
 *    durationMonths: number,        // 1,2,3,6,12
 *    durationLabel: '1 Month',
 *    sessions: number | null,       // video: total sessions, audio: null
 *    sessionMins: number | null,    // video: 30, audio: null
 *    price: number,                 // rupees (admin editable)
 *    mrp?: number,                  // optional, kata hua price
 *    isPopular: boolean,
 *    isActive: boolean,
 *    tagline?: string,
 *    features: string[],
 *    sortOrder: number
 *  }
 */

export type ProgramMode = 'video' | 'audio';
const MODES: ProgramMode[] = ['video', 'audio'];
const MODE_LABEL: Record<ProgramMode, string> = { video: 'Video Mode', audio: 'Audio Mode' };

export interface ProgramPlan {
  id: string;
  mode: ProgramMode;
  durationMonths: number;
  durationLabel: string;
  sessions: number | null;
  sessionMins: number | null;
  price: number;
  mrp: number | null;
  isPopular: boolean;
  isActive: boolean;
  tagline: string;
  discountPercent: number | null; // shown as the "Save N%" chip; 0 = admin removed it, null = not set
  features: string[];
  sortOrder: number;
}

export interface ApprovedTeacher {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

const toPlan = (id: string, d: any): ProgramPlan => ({
  id,
  mode: d.mode,
  durationMonths: d.durationMonths,
  durationLabel: d.durationLabel,
  sessions: d.sessions ?? null,
  sessionMins: d.sessionMins ?? null,
  price: d.price,
  mrp: d.mrp ?? null,
  isPopular: !!d.isPopular,
  isActive: d.isActive !== false,
  tagline: d.tagline ?? '',
  discountPercent: typeof d.discountPercent === 'number' ? d.discountPercent : null,
  features: Array.isArray(d.features) ? d.features : [],
  sortOrder: d.sortOrder ?? 0,
});

/** Plan load + validate. Inactive ya galat plan par error. */
export async function loadProgramPlan(planId: unknown): Promise<ProgramPlan> {
  if (typeof planId !== 'string' || !planId) {
    throw new functions.https.HttpsError('invalid-argument', 'planId is required.');
  }
  const snap = await admin.firestore().collection('subscriptionPlans').doc(planId).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'This plan does not exist.');
  }
  const plan = toPlan(snap.id, snap.data());
  if (!plan.isActive) {
    throw new functions.https.HttpsError('failed-precondition', 'This plan is not available right now.');
  }
  if (
    !MODES.includes(plan.mode) ||
    !Number.isInteger(plan.price) ||
    plan.price < 1 ||
    !Number.isInteger(plan.durationMonths) ||
    plan.durationMonths < 1
  ) {
    console.error('Invalid plan config:', planId, snap.data());
    throw new functions.https.HttpsError('internal', 'This plan is not configured correctly.');
  }
  if (plan.mode === 'video' && (!Number.isInteger(plan.sessions) || (plan.sessions as number) < 1)) {
    console.error('Video plan without sessions:', planId);
    throw new functions.https.HttpsError('internal', 'This plan is not configured correctly.');
  }
  return plan;
}

/**
 * Teacher admin-approved hona chahiye (session_teachers me, isActive != false)
 * aur us mode ko padhata ho. `modes` field abhi nahi hai to purane teachers
 * dono modes ke liye maane jaate hain (Phase 4 me admin har teacher ka mode set karega).
 */
export async function loadApprovedTeacher(
  teacherId: unknown,
  mode: ProgramMode
): Promise<ApprovedTeacher> {
  if (typeof teacherId !== 'string' || !teacherId) {
    throw new functions.https.HttpsError('invalid-argument', 'Please choose a teacher first.');
  }
  const snap = await admin.firestore().collection('session_teachers').doc(teacherId).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'This teacher was not found.');
  }
  const t = snap.data()!;
  if (t.isActive === false) {
    throw new functions.https.HttpsError('failed-precondition', 'This teacher is not available.');
  }
  if (Array.isArray(t.modes) && !t.modes.includes(mode)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `This teacher does not teach ${MODE_LABEL[mode]}.`
    );
  }
  if (!t.email) {
    throw new functions.https.HttpsError('failed-precondition', 'This teacher profile is incomplete.');
  }
  return {
    id: snap.id,
    name: t.name || 'Teacher',
    email: String(t.email).toLowerCase(),
    photoUrl: t.photoUrl || null,
  };
}

/** Ek mode me ek hi active plan: jab tak chal raha hai, doosra nahi bik sakta. */
export async function assertNoActiveProgram(uid: string, mode: ProgramMode): Promise<void> {
  const snap = await admin.firestore().collection('subscriptions').doc(`${uid}_${mode}`).get();
  const s = snap.data();
  const expiresMs: number = s?.expiresAt?.toMillis?.() ?? 0;
  if (s?.status === 'active' && expiresMs > Date.now()) {
    const till = new Date(expiresMs).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Your ${MODE_LABEL[mode]} plan is already active till ${till}. You can buy a new plan after it expires.`
    );
  }
}

export async function computeProgramPricing(
  plan: ProgramPlan,
  couponCode?: unknown
): Promise<PricingBreakdown> {
  const { couponDiscount, appliedCode } = await resolveCoupon(plan.id, plan.price, couponCode);
  const sessionsText = plan.sessions ? ` · ${plan.sessions} Sessions` : '';
  return buildBreakdown({
    planId: plan.id,
    planName: `${MODE_LABEL[plan.mode]} · ${plan.durationLabel}${sessionsText}`,
    mrp: plan.mrp && plan.mrp > plan.price ? plan.mrp : plan.price,
    price: plan.price,
    couponDiscount,
    appliedCode,
  });
}

/** Sirf `admins` collection me jiska email hai wahi admin. Admin callables isi se guard hote hain. */
export async function assertAdmin(request: any) {
  const email = String(request.auth?.token?.email || '').toLowerCase();
  if (!request.auth || !email) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const snap = await admin.firestore().collection('admins').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can do this.');
  }
}

/** Plans list (duration + plan screens). mode zaroori, durationMonths optional. */
export const getProgramPlans = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const { mode, durationMonths } = request.data || {};
  if (!MODES.includes(mode)) {
    throw new functions.https.HttpsError('invalid-argument', "mode must be 'video' or 'audio'.");
  }
  const snap = await admin
    .firestore()
    .collection('subscriptionPlans')
    .where('mode', '==', mode)
    .where('isActive', '==', true)
    .get();

  let plans = snap.docs.map((d) => toPlan(d.id, d.data()));
  if (typeof durationMonths === 'number') {
    plans = plans.filter((p) => p.durationMonths === durationMonths);
  }
  plans.sort((a, b) => a.durationMonths - b.durationMonths || a.sortOrder - b.sortOrder);
  return { plans };
});

/** Review Your Plan screen: plan + teacher + coupon ke baad exact total. */
export const previewProgramPricing = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const { planId, teacherId, couponCode } = request.data || {};
  const plan = await loadProgramPlan(planId);
  const teacher = teacherId ? await loadApprovedTeacher(teacherId, plan.mode) : null;
  await assertNoActiveProgram(request.auth.uid, plan.mode);
  const pricing = await computeProgramPricing(plan, couponCode);
  return { plan, teacher, pricing };
});

/** Pehle se bane plans overwrite NAHI hote (admin ki badli hui price safe rehti hai). */
export const seedProgramPlans = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);

  const VIDEO_FEATURES = [
    'One-to-one attention',
    '30-minute sessions',
    'Flexible scheduling',
    'Detailed feedback',
    'Improve speaking, grammar & confidence',
    'Personalised learning plan',
  ];
  const AUDIO_FEATURES = [
    'Live trainer-led voice sessions',
    'Interactive speaking practice',
    'Fun activities & challenges',
    'Community learning',
    'Improve fluency and confidence',
    'Trainer interaction',
  ];

  // AUDIO (group classes): 2/3/6/12 months. Video-style session count nahi hota.
  // VIDEO (1-to-1): har duration me 3 plans (sessions fixed):
  //   1 month: 8 / 12 / 16      2 months: 20 / 24 / 32     3 months: 36 / 48 / 60
  //   6 months: 72 / 96 / 120   12 months: 150 / 180 / 240
  // Nayi video plans price 0 aur isActive:false se bante hain (video_1m_16 ka price pehle se set hai).
  // Admin Panel > Plan prices me price daalkar plan ko ON karo, tab students ko dikhega.
  const videoSeed = (months: number, label: string, sessions: number[]) =>
    Object.fromEntries(
      sessions.map((n, i) => [
        `video_${months}m_${n}`,
        {
          mode: 'video',
          durationMonths: months,
          durationLabel: label,
          sessions: n,
          sessionMins: 30,
          price: n === 16 ? 5999 : 0,
          startInactive: n !== 16,
          isPopular: i === sessions.length - 1, // biggest plan = "Most Popular"
          sortOrder: n,
          features: VIDEO_FEATURES,
        },
      ])
    );
  const seed: Record<string, any> = {
    audio_2m: { mode: 'audio', durationMonths: 2, durationLabel: '2 Months', price: 3999, tagline: 'Save more, learn better', sortOrder: 1, features: AUDIO_FEATURES },
    audio_3m: { mode: 'audio', durationMonths: 3, durationLabel: '3 Months', price: 5999, isPopular: true, tagline: 'Best value for serious learners', sortOrder: 1, features: AUDIO_FEATURES },
    audio_6m: { mode: 'audio', durationMonths: 6, durationLabel: '6 Months', price: 9999, tagline: 'Save 25%', sortOrder: 1, features: AUDIO_FEATURES },
    audio_12m: { mode: 'audio', durationMonths: 12, durationLabel: '12 Months', price: 15999, tagline: 'Save 40%', sortOrder: 1, features: AUDIO_FEATURES },
    ...videoSeed(1, '1 Month', [8, 12, 16]),
    ...videoSeed(2, '2 Months', [20, 24, 32]),
    ...videoSeed(3, '3 Months', [36, 48, 60]),
    ...videoSeed(6, '6 Months', [72, 96, 120]),
    ...videoSeed(12, '12 Months', [150, 180, 240]),
  };

  const db = admin.firestore();
  const created: string[] = [];
  const skipped: string[] = [];
  for (const [id, data] of Object.entries(seed)) {
    const ref = db.collection('subscriptionPlans').doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      skipped.push(id);
      continue;
    }
    const { startInactive, ...fields } = data;
    await ref.set({
      isPopular: false,
      ...fields,
      isActive: !startInactive,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created.push(id);
  }

  // 1 month ke 8 / 12 sessions pehle band kiye gaye the. Agar unki price set hai to wapas ON karo.
  const retiredDone: string[] = [];
  for (const id of ['video_1m_8', 'video_1m_12']) {
    const ref = db.collection('subscriptionPlans').doc(id);
    const snap = await ref.get();
    if (snap.exists && snap.data()!.isActive === false && Number(snap.data()!.price) >= 1) {
      await ref.update({ isActive: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      retiredDone.push(id);
    }
  }
  // Har duration ka sabse bada plan "Most Popular" (purane docs ko bhi update karo).
  const popularIds = ['video_1m_16', 'video_2m_32', 'video_3m_60', 'video_6m_120', 'video_12m_240'];
  for (const id of popularIds) {
    const ref = db.collection('subscriptionPlans').doc(id);
    if ((await ref.get()).exists) await ref.update({ isPopular: true });
  }

  return { created, skipped, retired: retiredDone };
});