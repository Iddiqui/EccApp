import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Speaking-challenge recordings are kept for 30 days.
// Every day at 03:00 IST this deletes:
//   1. Firestore `challenge_recordings` documents older than 30 days, together with their audio file
//   2. Leftover audio files under `challenges_recordings/` older than 30 days
//      (for example when an upload finished but the document was never saved)

const KEEP_DAYS = 30;
const BATCH = 200;
const MAX_BATCHES = 20; // up to 4000 recordings per run; the rest is picked up the next day

/** Storage path of a recording: stored `storagePath`, else parsed from the download URL. */
function pathOf(data: FirebaseFirestore.DocumentData): string | null {
  if (typeof data.storagePath === 'string' && data.storagePath) return data.storagePath;
  const url = data.audioUrl;
  if (typeof url !== 'string') return null;
  const m = url.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export const cleanupChallengeRecordings = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Asia/Kolkata', timeoutSeconds: 540 },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const cutoffMs = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs);

    let deletedDocs = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
      const snap = await db
        .collection('challenge_recordings')
        .where('createdAt', '<', cutoff)
        .limit(BATCH)
        .get();
      if (snap.empty) break;

      await Promise.all(
        snap.docs.map(async (d) => {
          const path = pathOf(d.data());
          if (path) {
            try {
              await bucket.file(path).delete({ ignoreNotFound: true });
            } catch (e) {
              console.log('recording file delete failed:', path, e);
            }
          }
        })
      );
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deletedDocs += snap.size;
      if (snap.size < BATCH) break;
    }

    // Orphan sweep: files older than 30 days that no document points to any more.
    let deletedFiles = 0;
    try {
      const [files] = await bucket.getFiles({ prefix: 'challenges_recordings/' });
      for (const f of files) {
        const created = Date.parse(String(f.metadata.timeCreated || ''));
        if (created && created < cutoffMs) {
          await f.delete({ ignoreNotFound: true });
          deletedFiles++;
        }
      }
    } catch (e) {
      console.log('orphan recording sweep failed:', e);
    }

    console.log(`cleanupChallengeRecordings: ${deletedDocs} records, ${deletedFiles} extra files removed.`);
  }
);