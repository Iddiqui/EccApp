// functions/src/practice/streak.ts
//
// STREAK (backend). A "day" is an Indian-time (IST) calendar day.
//  - recordPracticeActivity (callable): the app calls it when the student finishes ANY challenge
//    (Read & Record, Tongue Twisters, daily speaking topic, Community quiz / puzzle).
//    First challenge of a day: streak +1 (or restarts at 1 if a whole day was missed).
//    More challenges the same day: nothing changes.
//  - breakMissedStreaks (every day 00:05 IST): a student who did NOT complete any challenge during
//    the whole of yesterday loses the streak (streak = 0). The existing onStreakChange trigger then
//    sends the "Your streak ended" notification for streaks of 3+ days.
//  - sendStreakFinalWarning (every day 10:30 PM IST): "your streak ends at midnight" push to students
//    who still have not practiced today. (The 8 PM reminder is sendStreakReminders in notificationTriggers.ts.)
//
// Fields on users/{uid}: streak (number), lastPracticeDate ("YYYY-MM-DD", IST),
// longestStreak, bestStreak, completedLectureDates (array of "YYYY-MM-DD", the Home calendar uses it).
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendNotificationToUser } from '../notifications/notificationTriggers';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istDayKey = (ms: number): string => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

const ALLOWED_ACTIVITIES = ['read_record', 'tongue_twisters', 'daily_topic', 'quiz', 'puzzle'];

// Monday of the current week (IST) as "YYYY-MM-DD". The Weekly goal restarts every Monday.
const istWeekKey = (ms: number): string => {
  const d = new Date(ms + IST_OFFSET_MS);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
};

// "YYYY-MM-DD" from a string / Timestamp / Date, or null
function toDayKey(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  if (typeof value.toMillis === 'function') return istDayKey(value.toMillis());
  if (value instanceof Date) return istDayKey(value.getTime());
  return null;
}

export const recordPracticeActivity = functions.https.onCall(async (request: any) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login is required.');
  }
  const activity = String(request.data?.activity || '');
  if (!ALLOWED_ACTIVITIES.includes(activity)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unknown activity.');
  }

  const db = admin.firestore();
  const ref = db.collection('users').doc(uid);
  const now = Date.now();
  const today = istDayKey(now);
  const yesterday = istDayKey(now - DAY_MS);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d: any = snap.data() || {};
    const last = toDayKey(d.lastPracticeDate);
    const current = Number(d.streak) || 0;

    let next: number;
    if (last === today) next = Math.max(current, 1); // already counted today
    else if (last === yesterday) next = Math.max(current, 0) + 1; // continues the streak
    else next = 1; // first practice, or a whole day was missed

    // WEEKLY GOAL: every different challenge type finished this week counts once
    // (Read & Record, Tongue Twisters, Daily topic, Quiz, Puzzle = 5 challenges).
    const week = istWeekKey(now);
    const prevWeekly: any = d.weeklyChallenges || {};
    const doneBefore: string[] = prevWeekly.week === week && Array.isArray(prevWeekly.done) ? prevWeekly.done : [];
    const doneNow = doneBefore.includes(activity) ? doneBefore : [...doneBefore, activity];

    const longest = Math.max(Number(d.longestStreak) || 0, next);
    const best = Math.max(Number(d.bestStreak) || 0, next);

    tx.set(
      ref,
      {
        streak: next,
        longestStreak: longest,
        bestStreak: best,
        lastPracticeDate: today,
        completedLectureDates: admin.firestore.FieldValue.arrayUnion(today),
        weeklyChallenges: { week, done: doneNow },
      },
      { merge: true },
    );
    return { streak: next, increased: last !== today, today, weeklyDone: doneNow.length };
  });
});

// Walks through every user that has a streak (200 at a time)
async function forEachStreakUser(
  handler: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<void>,
) {
  const db = admin.firestore();
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = db.collection('users').where('streak', '>', 0).orderBy('streak').limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    await handler(snap.docs);
    last = snap.docs[snap.docs.length - 1];
  }
}

export const breakMissedStreaks = onSchedule(
  { schedule: '5 0 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const yesterday = istDayKey(Date.now() - DAY_MS);
    await forEachStreakUser(async (docs) => {
      // Missed = last practice is older than yesterday. (No date at all = old data, left untouched.)
      const missed = docs.filter((doc) => {
        const last = toDayKey(doc.data().lastPracticeDate);
        return last !== null && last < yesterday;
      });
      for (let i = 0; i < missed.length; i += 400) {
        const batch = db.batch();
        missed.slice(i, i + 400).forEach((doc) => batch.update(doc.ref, { streak: 0 }));
        await batch.commit();
      }
    });
  },
);

export const sendStreakFinalWarning = onSchedule(
  { schedule: '30 22 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const today = istDayKey(Date.now());
    const yesterday = istDayKey(Date.now() - DAY_MS);
    await forEachStreakUser(async (docs) => {
      // Streak still alive (practiced yesterday) but nothing done today yet
      const due = docs.filter((doc) => toDayKey(doc.data().lastPracticeDate) === yesterday);
      for (let i = 0; i < due.length; i += 25) {
        await Promise.allSettled(
          due.slice(i, i + 25).map((doc) =>
            sendNotificationToUser(doc.id, {
              type: 'streak',
              title: 'Your streak ends at midnight ⏰',
              body: `Only about 90 minutes left! Finish one challenge now to keep your ${doc.data().streak}-day streak.`,
              targetScreen: 'Dashboard',
              targetTab: 'Practice',
            }),
          ),
        );
      }
    });
    void today;
  },
);