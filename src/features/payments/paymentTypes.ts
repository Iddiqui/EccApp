// src/payments/paymentTypes.ts

export type PaymentKind = 'subscription' | 'one_to_one';

// Server ke getPlans se aata hai (functions/src/payments/pricing.ts ke PLANS)
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  durationDays?: number;
  durationLabel: string;
  features: string[];
  isPopular?: boolean;
}

// Server ka order summary (coupon / order summary screen ke liye)
export interface PricingBreakdown {
  planId: string;
  planName: string;
  mrp: number;
  planDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  gst: number;
  gstIncluded: boolean;
  total: number;
  payablePaise: number;
}

export interface CreateOrderRequest {
  type: PaymentKind;
  planId?: string; // subscription
  couponCode?: string; // subscription
  bookingId?: string; // one_to_one
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  pricing: PricingBreakdown | null; // one_to_one me null
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  type: PaymentKind;
  alreadyProcessed: boolean;
  expiresAt?: number; // epoch millis, sirf subscription
}

// 🆕 Payment method selection screen ke options
export type PayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface PayParams {
  method?: PayMethod; // 🆕 na diya to purana behaviour (upi + card + netbanking)
  type?: PaymentKind; // default 'subscription'
  planId?: string;
  couponCode?: string;
  bookingId?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

export interface PayResult {
  success: true;
  orderId: string;
  paymentId: string;
  type: PaymentKind;
  expiresAt?: number;
  pricing: PricingBreakdown | null;
}

/**
 * payWithRazorpay jo errors throw karta hai un par `code` aur `paymentTaken` hota hai:
 *  CANCELLED : user ne khud checkout band kiya (message 'CANCELLED')
 *  FAILED    : payment fail hua (paisa NAHI kata)
 *  PENDING   : paisa kat gaya par confirm abhi nahi hua. Webhook activate kar dega.
 *  REFUND    : paisa kat gaya par booking confirm nahi ho sakti. Refund hoga.
 * paymentTaken === true ka matlab: slot/booking ko cancel MAT karo.
 */
export type PaymentErrorCode = 'CANCELLED' | 'FAILED' | 'PENDING' | 'REFUND';