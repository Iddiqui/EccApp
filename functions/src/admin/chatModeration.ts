// functions/src/admin/chatModeration.ts
//
// Community chat moderation: Firestore/Storage rules cannot search the `admins` / `sub_admins`
// collections by email, so we keep a uid-keyed mirror: admin_uids/{uid}.
//  - syncChatAdmin (callable): the app calls it when a signed-in admin opens the Community chat.
//    It checks the admin lists by email and registers (or removes) that user's uid.
//  - onAdminListWrite / onSubAdminListWrite: when an admin doc is deleted, remove the mirror.
// admin_uids is written ONLY here (admin SDK). The rules do not allow client writes.
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';

const REGION = 'asia-south2';

async function emailIsListed(email: string): Promise<boolean> {
  const db = admin.firestore();
  const [a, b] = await Promise.all([
    db.collection('admins').where('email', '==', email).limit(1).get(),
    db.collection('sub_admins').where('email', '==', email).limit(1).get(),
  ]);
  return !a.empty || !b.empty;
}

export const syncChatAdmin = functions.https.onCall(async (request: any) => {
  const uid = request.auth?.uid;
  const email = String(request.auth?.token?.email || '').toLowerCase();
  if (!uid || !email) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const ref = admin.firestore().collection('admin_uids').doc(uid);
  if (await emailIsListed(email)) {
    await ref.set({ email, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { admin: true };
  }
  await ref.delete().catch(() => {});
  return { admin: false };
});

async function revokeIfNoLongerListed(deletedEmail: any) {
  const email = String(deletedEmail || '').toLowerCase();
  if (!email) return;
  if (await emailIsListed(email)) return; // still an admin through the other list
  const snap = await admin.firestore().collection('admin_uids').where('email', '==', email).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

export const onAdminListDeleted = onDocumentDeleted(
  { document: 'admins/{id}', region: REGION },
  async (event) => revokeIfNoLongerListed(event.data?.data()?.email)
);

export const onSubAdminListDeleted = onDocumentDeleted(
  { document: 'sub_admins/{id}', region: REGION },
  async (event) => revokeIfNoLongerListed(event.data?.data()?.email)
);