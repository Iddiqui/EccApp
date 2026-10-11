import * as functions from 'firebase-functions';
import { computePricing, PLANS } from './pricing';

/**
 * getPlans
 * --------
 * SubscriptionScreen ye call karke plans dikhati hai, taaki screen pe dikhne
 * wali price hamesha server ki price se match kare.
 */
export const getPlans = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  return { plans: Object.values(PLANS) };
});

/**
 * previewPricing
 * --------------
 * Coupon / Order Summary screen ke liye. Order nahi banata, sirf exact
 * breakdown deta hai. Wahi computePricing() chalti hai jo createOrder me
 * chalti hai, isliye summary ka total aur asli charge hamesha same rahega.
 */
export const previewPricing = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const { planId, couponCode } = request.data || {};
  return computePricing(planId, couponCode);
});