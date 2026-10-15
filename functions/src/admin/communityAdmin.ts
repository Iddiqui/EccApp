import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { assertAdmin } from '../payments/programPlans';

// functions/src/admin/communityAdmin.ts
//
// Community feed: a user deletes only their own post (Firestore rules).
// Deleting SOMEONE ELSE'S post is admin-only and goes through this function.
// assertAdmin checks the `admins` collection by email (same as the Admin Panel).
export const adminDeletePost = functions.https.onCall(async (request: any) => {
  await assertAdmin(request);
  const { postId } = request.data || {};
  if (typeof postId !== 'string' || !postId) {
    throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
  }
  await admin.firestore().collection('posts').doc(postId).delete();
  return { success: true };
});