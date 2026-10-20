// src/services/streakService.ts
// Streak helpers used by every challenge screen.
import functions from '@react-native-firebase/functions';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istDayKey = (ms: number): string => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

export type PracticeActivity = 'read_record' | 'tongue_twisters' | 'daily_topic' | 'quiz' | 'puzzle';

/**
 * Tells the backend that the student finished a challenge today.
 * The server decides if the streak goes up (first challenge of the day) or restarts.
 * Never throws: a failed call must not break the challenge screen.
 */
export const recordPracticeActivity = async (
  activity: PracticeActivity,
): Promise<{ streak: number; increased: boolean } | null> => {
  try {
    const res: any = await functions().httpsCallable('recordPracticeActivity')({ activity });
    return res?.data || null;
  } catch (e) {
    console.log('Could not record the streak:', e);
    return null;
  }
};

const toKey = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  if (typeof value.toDate === 'function') return istDayKey(value.toDate().getTime());
  return null;
};

/** The streak to SHOW. If the last practice day is older than yesterday the streak is already broken. */
export const getEffectiveStreak = (userData: any): number => {
  const streak = Number(userData?.streak) || 0;
  if (streak <= 0) return 0;
  const last = toKey(userData?.lastPracticeDate);
  if (!last) return streak; // old data without a date: show the saved number
  const today = istDayKey(Date.now());
  const yesterday = istDayKey(Date.now() - DAY_MS);
  return last === today || last === yesterday ? streak : 0;
};

/** true when a challenge is already done today (the streak is safe for today) */
export const practicedToday = (userData: any): boolean => toKey(userData?.lastPracticeDate) === istDayKey(Date.now());