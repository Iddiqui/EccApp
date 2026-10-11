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
  // 🆕 PHASE 4: Audio Mode plan (subscriptions/{uid}_audio) se group classes ka access.
  const audio = await getProgramAccess(uid, 'audio');
  if (audio.active) return { hasAccess: true, expiresAt: audio.expiresAt };

  // Purani Class Room subscription (users/{uid}.subscription) ab bhi chalti hai,
  // taaki jo students pehle se paid hain unka access na toote.
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

// ═══════════════════════════════════════════════════════════════════
//  🆕 VIDEO / AUDIO PROGRAM ACCESS  (subscriptions/{uid}_{mode})
//  Asli enforcement booking/join functions me yahi helper use karke hogi;
//  app ka getMySubscriptions sirf UI dikhane ke liye hai.
// ═══════════════════════════════════════════════════════════════════
export type ProgramModeKey = 'video' | 'audio';

export interface ProgramAccess {
  active: boolean;
  reason?: 'none' | 'expired' | 'no_sessions_left';
  mode: ProgramModeKey;
  planName?: string;
  durationLabel?: string;
  teacherId?: string;
  teacherName?: string;
  teacherPhotoUrl?: string | null;
  sessionMins?: number | null;
  totalSessions?: number | null;
  usedSessions?: number | null;
  remainingSessions?: number | null;
  startAt?: number;
  expiresAt?: number;
}

export async function getProgramAccess(uid: string, mode: ProgramModeKey): Promise<ProgramAccess> {
  const ref = admin.firestore().collection('subscriptions').doc(`${uid}_${mode}`);
  const snap = await ref.get();
  if (!snap.exists) return { active: false, reason: 'none', mode };

  const s = snap.data()!;
  const expiresAt: number = s.expiresAt?.toMillis?.() ?? 0;

  if (s.status !== 'active' || expiresAt < Date.now()) {
    if (s.status === 'active') {
      await ref.update({ status: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return { active: false, reason: 'expired', mode, expiresAt };
  }

  const base: ProgramAccess = {
    active: true,
    mode,
    planName: s.planName,
    durationLabel: s.durationLabel,
    teacherId: s.teacherId,
    teacherName: s.teacherName,
    teacherPhotoUrl: s.teacherPhotoUrl ?? null,
    sessionMins: s.sessionMins ?? null,
    totalSessions: s.totalSessions ?? null,
    usedSessions: s.usedSessions ?? null,
    remainingSessions: s.remainingSessions ?? null,
    startAt: s.startAt?.toMillis?.(),
    expiresAt,
  };

  // Video: sessions khatam to booking band (plan active rehta hai)
  if (mode === 'video' && (s.remainingSessions ?? 0) <= 0) {
    return { ...base, active: false, reason: 'no_sessions_left' };
  }
  return base;
}

/** Dashboard / flow ke liye: dono modes ka status ek saath. */
export const getMySubscriptions = functions.https.onCall(async (request: any) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const [video, audio] = await Promise.all([
    getProgramAccess(request.auth.uid, 'video'),
    getProgramAccess(request.auth.uid, 'audio'),
  ]);
  return { video, audio };
});