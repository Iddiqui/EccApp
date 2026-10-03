import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export interface AccessStatus {
  hasAccess: boolean;
  reason?: 'no_subscription' | 'expired';
  expiresAt?: number; // epoch millis
}

/**
 * Shared logic: checkClassRoomAccess aur getLiveKitToken (index.ts) dono yahi
 * use karte hain. Schema pehle jaisa: users/{uid}.subscription = { status, expiresAt, ... }
 */
export async function getAccessStatus(uid: string): Promise<AccessStatus> {
  const userRef = admin.firestore().collection('users').doc(uid);
  const userDoc = await userRef.get();
  const subscription = userDoc.data()?.subscription;

  if (!subscription || subscription.status !== 'active') {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  const expiresAt = subscription.expiresAt?.toDate?.();
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    // Expiry mil gayi — status ko lazily "expired" flip kar dete hain
    await userRef.set({ subscription: { status: 'expired' } }, { merge: true });
    return { hasAccess: false, reason: 'expired' };
  }

  return { hasAccess: true, expiresAt: expiresAt?.getTime() };
}

/**
 * checkClassRoomAccess
 * --------------------
 * ClassRoomScreen isko JOIN se pehle call karta hai (UX ke liye, taaki
 * "subscribe karo" screen dikha sake). Asli enforcement getLiveKitToken me
 * hoti hai, kyunki client-side check bypass ho sakta hai.
 */
export const checkClassRoomAccess = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  return getAccessStatus(request.auth.uid);
});