// src/payments/paymentService.ts
//
// Install (agar pehle se nahi hai):
//   npm i react-native-razorpay @react-native-firebase/functions
// Native module hai, install ke baad app dobara build karni padegi.

import RazorpayCheckout from 'react-native-razorpay';
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  PayParams,
  PayResult,
  PaymentErrorCode,
  PricingBreakdown,
  ProgramAccess,
  ProgramMode,
  ProgramPlan,
  ProgramPreview,
  SubscriptionPlan,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from './paymentTypes';

// Region: tumhare baaki functions (getLiveKitToken, createBooking...) default
// region me hain, isliye yahan bhi default. Agar baaki app me tum koi region
// pass karte ho to yahan bhi wahi rakhna.
const functions = getFunctions(getApp());

const createOrderFn = httpsCallable<CreateOrderRequest, CreateOrderResponse>(
  functions,
  'createOrder'
);
const verifyPaymentFn = httpsCallable<VerifyPaymentRequest, VerifyPaymentResponse>(
  functions,
  'verifyPayment'
);
const getPlansFn = httpsCallable<Record<string, never>, { plans: SubscriptionPlan[] }>(
  functions,
  'getPlans'
);
const previewPricingFn = httpsCallable<
  { planId: string; couponCode?: string },
  PricingBreakdown
>(functions, 'previewPricing');

// ─── 🆕 Video / Audio program plans ───
const getProgramPlansFn = httpsCallable<
  { mode: ProgramMode; durationMonths?: number },
  { plans: ProgramPlan[] }
>(functions, 'getProgramPlans');
const previewProgramFn = httpsCallable<
  { planId: string; teacherId?: string; couponCode?: string },
  ProgramPreview
>(functions, 'previewProgramPricing');
const checkClassRoomAccessFn = httpsCallable<
  Record<string, never>,
  { hasAccess: boolean; reason?: string; expiresAt?: number }
>(functions, 'checkClassRoomAccess');

const getMySubscriptionsFn = httpsCallable<
  Record<string, never>,
  { video: ProgramAccess; audio: ProgramAccess }
>(functions, 'getMySubscriptions');

/** Duration + plan screens: plans server (Firestore subscriptionPlans) se. */
export async function getProgramPlans(
  mode: ProgramMode,
  durationMonths?: number
): Promise<ProgramPlan[]> {
  const { data } = await getProgramPlansFn({ mode, durationMonths });
  return data.plans;
}

/** Review Your Plan: plan + teacher + coupon ke baad exact total. */
export async function previewProgram(
  planId: string,
  teacherId?: string,
  couponCode?: string
): Promise<ProgramPreview> {
  const { data } = await previewProgramFn({ planId, teacherId, couponCode });
  return data;
}

/** Dono modes ka subscription status (dashboard / locks ke liye). */
export async function getMySubscriptions(): Promise<{ video: ProgramAccess; audio: ProgramAccess }> {
  const { data } = await getMySubscriptionsFn({});
  return data;
}

/** SubscriptionScreen ke liye: plans + prices server se. */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  const { data } = await getPlansFn({});
  return data.plans;
}

/** Coupon / Order Summary screen ke liye: server se exact breakdown. */
export async function getPricing(
  planId: string,
  couponCode?: string
): Promise<PricingBreakdown> {
  const { data } = await previewPricingFn({ planId, couponCode });
  return data;
}

function payError(message: string, code: PaymentErrorCode, paymentTaken: boolean) {
  const e: any = new Error(message);
  e.code = code;
  e.paymentTaken = paymentTaken;
  return e as Error & { code: PaymentErrorCode; paymentTaken: boolean };
}

function isCheckoutCancelled(e: any): boolean {
  const desc = String(e?.description ?? e?.error?.description ?? '');
  return e?.code === 0 || /cancel/i.test(desc);
}

function isFailedPrecondition(e: any): boolean {
  return String(e?.code ?? '').includes('failed-precondition');
}

// Network blip par 2 baar aur try karte hain. failed-precondition (refund case) retry nahi hota.
async function verifyWithRetry(req: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await verifyPaymentFn(req);
      return data;
    } catch (e: any) {
      lastErr = e;
      if (isFailedPrecondition(e)) throw e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * order banao → Razorpay checkout → server pe verify.
 *
 * Purana call style (sessionService me tha) bhi chalta hai:
 *   payWithRazorpay({ type: 'one_to_one' }, { bookingId })
 * `amount` ab ignore hota hai, price hamesha server decide karta hai.
 *
 * 🎯 PAYMENT METHODS CUSTOMIZATION (27 Sep 2026): checkout screen me pehle
 * Cards, EMI, Netbanking, Wallet — sab methods equal footing pe dikhte the.
 * Ab EMI aur Wallet ko checkout se hata diya hai (`config.display.blocks`
 * me un blocks ko simply add nahi kiya, aur `method.emi` / `method.wallet`
 * ko false kar diya redundancy ke liye), aur UPI ko top par ek dedicated
 * "QR ya UPI se pay karein" block ke roop me highlight kiya hai — kyunki
 * India me students ke liye UPI/QR sabse fast aur familiar tareeka hai.
 * Cards aur Netbanking dusre block me still available hain (extra options
 * ke liye), bas EMI/Wallet completely hide hain.
 *
 * Razorpay checkout ke `config.display.blocks` / `hidden` / `sequence` ka
 * exact behavior SDK version pe depend karta hai — agar kisi wajah se
 * `config` ignore ho jaaye (purana native module version), to bhi
 * `method.emi: false` aur `method.wallet: false` fallback ke taur par
 * un methods ko checkout se hata dete hain.
 */
export async function payWithRazorpay(
  params: PayParams & { amount?: number },
  legacyOptions?: { bookingId?: string }
): Promise<PayResult> {
  const type = params.type ?? 'subscription';
  const bookingId = params.bookingId ?? legacyOptions?.bookingId;

  // 1) Server pe order (price server nikalta hai)
  const { data: order } = await createOrderFn({
    type,
    planId: params.planId,
    couponCode: params.couponCode,
    bookingId,
    teacherId: params.teacherId,
  });

  // 2) Razorpay checkout
  let rz: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };
  try {
    rz = await RazorpayCheckout.open({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'English Conversation Club',
      description: order.pricing?.planName ?? '1 to 1 Video Coaching',
      prefill: params.prefill,
      theme: { color: '#2563EB' },

      // 🎯 DEBUGGING NOTE (27 Sep 2026): pehle `config.display.blocks` wala
      // poora custom-checkout config try kiya tha, lekin UPI block phir
      // bhi nahi dikha — jab ke Razorpay Dashboard confirm karta hai UPI
      // "Activated" hai. Isse pata chalta hai ke `config.display.blocks`
      // shayad installed `react-native-razorpay` native SDK version me
      // support hi nahi hai (ye feature mainly Web Standard Checkout ke
      // liye documented hai, native mobile SDK me version-dependent hai).
      // Isliye ab sirf simple, widely-supported `method` object try kar
      // rahe hain — jisme sirf emi/wallet ko explicitly false karte hain,
      // baaki (upi, card, netbanking) Razorpay ki apni default list se
      // aayenge (UPI already dashboard pe activated hai, isliye dikhna
      // chahiye).
      // 🆕 Agar user ne apni payment-method screen par kuch chuna hai to sirf
      // wahi method Razorpay me khulega. Kuch nahi chuna (jaise subscription
      // flow abhi) to purana behaviour: upi + card + netbanking.
      method: (params.method
        ? {
            upi: params.method === 'upi',
            card: params.method === 'card',
            netbanking: params.method === 'netbanking',
            wallet: params.method === 'wallet',
            emi: false,
            paylater: false,
          }
        : {
            upi: true,
            card: true,
            netbanking: true,
            wallet: false,
            emi: false,
            paylater: false,
          }) as any,
    } as any);
  } catch (e: any) {
    // SubscriptionScreen isi message se cancel pehchanta hai
    if (isCheckoutCancelled(e)) throw payError('CANCELLED', 'CANCELLED', false);
    throw payError(
      e?.description || e?.error?.description || 'Payment failed.',
      'FAILED',
      false
    );
  }

  // 3) Server pe signature verify + entitlement. Yahan se paisa kat chuka hai.
  try {
    const data = await verifyWithRetry({
      razorpay_order_id: rz.razorpay_order_id,
      razorpay_payment_id: rz.razorpay_payment_id,
      razorpay_signature: rz.razorpay_signature,
    });
    return {
      success: true,
      orderId: rz.razorpay_order_id,
      paymentId: rz.razorpay_payment_id,
      type: data.type ?? type,
      expiresAt: data.expiresAt,
      pricing: order.pricing,
      program: data.program,
    };
  } catch (e: any) {
    if (isFailedPrecondition(e)) {
      // Server ne saaf bataya: paisa aaya par booking confirm nahi ho sakti (refund case)
      throw payError(
        e?.message ||
          'We received your payment, but the booking could not be confirmed. The amount will be refunded.',
        'REFUND',
        true
      );
    }
    // Network / server issue. Webhook baad me activate kar dega.
    throw payError(
      'Your payment went through, but confirmation is taking a little longer. ' +
        'Please do not pay again. It will be activated shortly.',
      'PENDING',
      true
    );
  }
}

/** ClassRoomScreen join se pehle isse access check karta hai (asli check server pe hota hai). */
export async function checkClassRoomAccess(): Promise<{
  hasAccess: boolean;
  reason?: string;
  expiresAt?: number;
}> {
  const { data } = await checkClassRoomAccessFn({});
  return data;
}