import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  PLANS: subscription ki price ka EK hi sach yahin hai.
 *  Price / plan badalna ho to SIRF yahin badlo. App ki SubscriptionScreen
 *  ye list `getPlans` function se fetch karti hai, isliye screen aur
 *  actual charge kabhi alag nahi ho sakte.
 * ═══════════════════════════════════════════════════════════════════
 */
export interface Plan {
  id: string;
  name: string;
  mrp: number; // rupees (kaata hua price dikhane ke liye)
  price: number; // rupees (asli charge)
  durationDays: number;
  durationLabel: string;
  features: string[];
  isPopular?: boolean;
}

export const PLANS: Record<string, Plan> = {
  voice_quarterly: {
    id: 'voice_quarterly',
    name: 'Quarterly',
    mrp: 9000,
    price: 4999,
    durationDays: 90,
    durationLabel: '90 din',
    features: [
      'Unlimited Class Rooms access',
      'Live sessions with teachers',
      'Progress tracking',
    ],
    isPopular: true,
  },
  voice_yearly: {
    id: 'voice_yearly',
    name: 'Yearly',
    mrp: 36500,
    price: 19999,
    durationDays: 365,
    durationLabel: '365 din',
    features: [
      'Everything in Quarterly',
      'Priority support',
      'Exclusive events',
    ],
  },
  // Monthly chahiye to yahin ek aur block add kar do, e.g.
  // voice_monthly: { id: 'voice_monthly', name: 'Monthly', mrp: ..., price: ..., durationDays: 30, ... },
};

const GST_RATE = 0.18;
// true  = plan ka price GST milake hai (user jo price dekhta hai wahi pay karta hai)
// false = GST upar se judega. Apne CA se confirm kar lo.
const PRICES_INCLUDE_GST = true;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PricingBreakdown {
  planId: string;
  planName: string;
  mrp: number;
  planDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  gst: number;
  gstIncluded: boolean;
  total: number; // rupees, jo user pay karega
  payablePaise: number;
}

/**
 * coupons/{CODE} document (CODE hamesha UPPERCASE doc id):
 *  { type: 'flat' | 'percent', value: number, active: boolean,
 *    maxDiscount?: number, expiresAt?: Timestamp, usageLimit?: number,
 *    usedCount: number, planIds?: string[] }
 */
export async function computePricing(
  planId: unknown,
  couponCode?: unknown
): Promise<PricingBreakdown> {
  if (typeof planId !== 'string' || !PLANS[planId]) {
    throw new functions.https.HttpsError('invalid-argument', 'The plan is not valid.');
  }
  const plan = PLANS[planId];

  let couponDiscount = 0;
  let appliedCode: string | null = null;

  if (typeof couponCode === 'string' && couponCode.trim()) {
    const code = couponCode.trim().toUpperCase();
    const snap = await admin.firestore().collection('coupons').doc(code).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'The coupon is not valid..');
    }
    const c = snap.data()!;

    if (!c.active)
      throw new functions.https.HttpsError('failed-precondition', 'This coupon is not active.');
    if (c.expiresAt && c.expiresAt.toMillis() < Date.now())
      throw new functions.https.HttpsError('failed-precondition', 'This coupon has expired.');
    if (c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit)
      throw new functions.https.HttpsError('failed-precondition', 'The limit for this coupon has been reached.');
    if (Array.isArray(c.planIds) && c.planIds.length && !c.planIds.includes(planId))
      throw new functions.https.HttpsError('failed-precondition', 'This coupon does not apply to this plan.');

    couponDiscount =
      c.type === 'percent' ? Math.floor((plan.price * c.value) / 100) : c.value;
    if (c.maxDiscount) couponDiscount = Math.min(couponDiscount, c.maxDiscount);
    // Razorpay ka minimum order ₹1 hai
    couponDiscount = Math.max(0, Math.min(couponDiscount, plan.price - 1));
    appliedCode = code;
  }

  const afterCoupon = plan.price - couponDiscount;
  const gst = PRICES_INCLUDE_GST
    ? round2(afterCoupon - afterCoupon / (1 + GST_RATE))
    : round2(afterCoupon * GST_RATE);
  const total = PRICES_INCLUDE_GST ? afterCoupon : round2(afterCoupon + gst);

  return {
    planId,
    planName: plan.name,
    mrp: plan.mrp,
    planDiscount: plan.mrp - plan.price,
    couponCode: appliedCode,
    couponDiscount,
    gst,
    gstIncluded: PRICES_INCLUDE_GST,
    total,
    payablePaise: Math.round(total * 100),
  };
}