import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import type { Booking } from './sessionTypes';

// Session end time is IST (+05:30), same as the server.
const endMs = (b: Booking) => new Date(`${b.date}T${b.endTime}:00+05:30`).getTime();

/**
 * Finished, paid/confirmed sessions of this student that are not rated yet (newest first).
 * Uses the single-field studentId index only, so no extra Firestore index is needed.
 */
export async function getSessionsToReview(): Promise<Booking[]> {
  const uid = auth().currentUser?.uid;
  if (!uid) return [];
  const snap = await firestore().collection('bookings').where('studentId', '==', uid).get();
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Booking & { reviewed?: boolean }))
    .filter((b) => b.status === 'confirmed' && !b.reviewed && endMs(b) <= now)
    .sort((a, b) => endMs(b) - endMs(a))
    .slice(0, 20);
}

export async function submitReview(bookingId: string, rating: number, comment: string) {
  try {
    await functions().httpsCallable('submitReview')({ bookingId, rating, comment });
  } catch (e: any) {
    // Show the server's message (for example "You have already rated this session.")
    throw new Error(e?.message || 'Could not submit your review. Please try again.');
  }
}