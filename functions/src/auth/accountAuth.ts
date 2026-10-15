import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// functions/src/auth/accountAuth.ts
//
// Server side of: email verification code, "Complete your profile" and
// forgot-password (email code / phone OTP).
//
//  - Email codes are sent from your own mailbox (Gmail app password) via SMTP.
//      firebase functions:secrets:set SMTP_USER   (e.g. yourname@gmail.com)
//      firebase functions:secrets:set SMTP_PASS   (16-character Gmail "App password")
//  - Phone OTPs are sent by Firebase Authentication itself (client side).
//  - Codes are stored only as a salted hash in `authCodes/*` (admin SDK only).

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const CODE_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
const RESEND_GAP_MS = 45 * 1000; // minimum gap between two codes
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const MAX_SENDS_PER_DAY = 8; // codes per email per day
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GENDERS = ['male', 'female', 'other'];

const bad = (msg: string) => new HttpsError('invalid-argument', msg);

const normEmail = (v: unknown): string => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(e) || e.length > 120) throw bad('Please enter a valid email address.');
  return e;
};

const checkPassword = (v: unknown): string => {
  if (typeof v !== 'string' || v.length < 6 || v.length > 128) {
    throw bad('Password must be at least 6 characters.');
  }
  return v;
};

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const codeDocId = (purpose: string, email: string) => sha(`${purpose}:${email}`);

async function userByEmail(email: string): Promise<admin.auth.UserRecord | null> {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function sendMail(to: string, code: string, purpose: 'verify' | 'reset') {
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();
  if (!user || !pass) {
    throw new HttpsError('failed-precondition', 'Email service is not set up yet. Please contact support.');
  }
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const what = purpose === 'reset' ? 'reset your password' : 'verify your email address';
  await transporter.sendMail({
    from: `"ECC - English Conversation Club" <${user}>`,
    to,
    subject: `${code} is your ECC verification code`,
    text: `Your ECC code to ${what} is ${code}. It is valid for 10 minutes. If you did not ask for this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #E2E8F0;border-radius:16px">
      <h2 style="margin:0 0 8px;color:#0F172A">ECC</h2>
      <p style="color:#475569">Use this code to ${what}:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:800;color:#5356FF;margin:16px 0">${code}</p>
      <p style="color:#64748B;font-size:13px">It is valid for 10 minutes. If you did not ask for this, you can ignore this email.</p>
    </div>`,
  });
}

/** Creates and mails a fresh 6-digit code. Enforces the resend gap and a daily cap. */
async function issueCode(purpose: 'verify' | 'reset', email: string, uid?: string) {
  const db = admin.firestore();
  const ref = db.collection('authCodes').doc(codeDocId(purpose, email));
  const snap = await ref.get();
  const old = snap.exists ? (snap.data() as any) : null;
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  if (old && now - (old.sentAt || 0) < RESEND_GAP_MS) {
    throw new HttpsError('resource-exhausted', 'Please wait a few seconds before asking for another code.');
  }
  const sendsToday = old && old.day === today ? old.sends || 0 : 0;
  if (sendsToday >= MAX_SENDS_PER_DAY) {
    throw new HttpsError('resource-exhausted', 'Too many codes requested today. Please try again tomorrow.');
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(8).toString('hex');
  await sendMail(email, code, purpose); // if the mail fails, nothing is stored
  await ref.set({
    email,
    purpose,
    uid: uid || null,
    salt,
    codeHash: sha(`${salt}:${code}`),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
    day: today,
    sends: sendsToday + 1,
  });
}

/** Checks a code. Wrong guesses are counted; the code is consumed on success. */
async function consumeCode(purpose: 'verify' | 'reset', email: string, code: unknown) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw bad('Enter the 6-digit code.');
  const ref = admin.firestore().collection('authCodes').doc(codeDocId(purpose, email));
  const snap = await ref.get();
  const d = snap.exists ? (snap.data() as any) : null;
  if (!d || Date.now() > d.expiresAt) {
    throw new HttpsError('deadline-exceeded', 'This code has expired. Please request a new one.');
  }
  if ((d.attempts || 0) >= MAX_ATTEMPTS) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Too many wrong attempts. Please request a new code.');
  }
  const given = Buffer.from(sha(`${d.salt}:${code.trim()}`));
  const real = Buffer.from(String(d.codeHash));
  const ok = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!ok) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError('permission-denied', 'Incorrect code. Please check it and try again.');
  }
  await ref.delete();
  return d;
}

// ───────────────────────── 1. Send a code ─────────────────────────
//  purpose 'verify': signed-in user proves they own an email address
//  purpose 'reset' : forgot password (no sign-in). Always answers "sent", so nobody can
//                    find out which emails have an account.
export const sendEmailCode = onCall({ secrets: [SMTP_USER, SMTP_PASS] }, async (request) => {
  const purpose = request.data?.purpose === 'reset' ? 'reset' : 'verify';
  const email = normEmail(request.data?.email);

  if (purpose === 'verify') {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please log in first.');
    const other = await userByEmail(email);
    if (other && other.uid !== request.auth.uid) {
      throw new HttpsError('already-exists', 'This email is already registered with another account.');
    }
    await issueCode('verify', email, request.auth.uid);
    return { sent: true };
  }

  const u = await userByEmail(email);
  if (u) await issueCode('reset', email, u.uid);
  return { sent: true };
});

// ───────────────────────── 2. Verify an email code ─────────────────────────
export const verifyEmailCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please log in first.');
  const email = normEmail(request.data?.email);
  const d = await consumeCode('verify', email, request.data?.code);
  if (d.uid && d.uid !== request.auth.uid) throw new HttpsError('permission-denied', 'This code is not for your account.');
  await admin
    .firestore()
    .collection('users')
    .doc(request.auth.uid)
    .set(
      { verifiedEmail: email, verifiedEmailAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  return { verified: true };
});

// ───────────────────────── 3. Complete the profile ─────────────────────────
//  The phone must already be linked to the account (verified by OTP in the app) and the
//  email must be verified by code. Only then is `profileComplete` switched on.
export const completeProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please log in first.');
  const uid = request.auth.uid;
  const { fullName, age, gender, password } = request.data || {};
  const email = normEmail(request.data?.email);

  const name = typeof fullName === 'string' ? fullName.trim() : '';
  if (name.length < 2 || name.length > 60) throw bad('Please enter your full name.');
  const ageNum = Number(age);
  if (!Number.isInteger(ageNum) || ageNum < 10 || ageNum > 100) throw bad('Please enter a valid age (10 to 100).');
  const g = typeof gender === 'string' ? gender.trim().toLowerCase() : '';
  if (!GENDERS.includes(g)) throw bad('Please choose your gender.');

  const db = admin.firestore();
  const rec = await admin.auth().getUser(uid);

  // Phone: must be verified (linked through Firebase OTP)
  if (!rec.phoneNumber) throw new HttpsError('failed-precondition', 'Please verify your mobile number first.');

  // Email: either already verified on the account, or just verified by code
  const sameEmail = (rec.email || '').toLowerCase() === email;
  let emailOk = sameEmail && rec.emailVerified;
  if (!emailOk) {
    const u = (await db.collection('users').doc(uid).get()).data() || {};
    const at = u.verifiedEmailAt?.toMillis ? u.verifiedEmailAt.toMillis() : 0;
    emailOk = u.verifiedEmail === email && Date.now() - at < 60 * 60 * 1000;
  }
  if (!emailOk) throw new HttpsError('failed-precondition', 'Please verify your email address first.');

  // Password: needed when the account has no password sign-in yet (phone / Google users)
  const hasPasswordLogin = rec.providerData.some((p) => p.providerId === 'password');
  const update: admin.auth.UpdateRequest = { displayName: name, emailVerified: true };
  if (!sameEmail) {
    const other = await userByEmail(email);
    if (other && other.uid !== uid) throw new HttpsError('already-exists', 'This email is already registered with another account.');
    update.email = email;
  }
  if (!hasPasswordLogin || !sameEmail) {
    update.password = checkPassword(password);
  } else if (password) {
    update.password = checkPassword(password);
  }
  try {
    await admin.auth().updateUser(uid, update);
  } catch (e: any) {
    if (e?.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email is already registered with another account.');
    throw e;
  }

  const digits = rec.phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');
  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        uid,
        fullName: name,
        email,
        phone: digits,
        phoneE164: rec.phoneNumber,
        age: ageNum,
        gender: g,
        emailVerified: true,
        phoneVerified: true,
        profileComplete: true,
        profileCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedEmail: admin.firestore.FieldValue.delete(),
        verifiedEmailAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
  return { success: true, passwordChanged: update.password !== undefined };
});

// ───────────────────────── 4. Forgot password: email code ─────────────────────────
export const resetPasswordWithEmailCode = onCall(async (request) => {
  const email = normEmail(request.data?.email);
  const newPassword = checkPassword(request.data?.newPassword);
  const u = await userByEmail(email);
  if (!u) throw new HttpsError('permission-denied', 'Incorrect code. Please check it and try again.');
  await consumeCode('reset', email, request.data?.code);
  await admin.auth().updateUser(u.uid, { password: newPassword });
  return { success: true };
});

// ───────────────────────── 5. Forgot password: phone OTP ─────────────────────────
//  The app signs the user in with the OTP first. This function only accepts a fresh phone
//  sign-in (last 10 minutes) and sets the new password for that account.
export const resetPasswordWithPhone = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please verify your mobile number first.');
  const t: any = request.auth.token;
  const freshSecs = Date.now() / 1000 - Number(t.auth_time || 0);
  if (t.firebase?.sign_in_provider !== 'phone' || freshSecs > 600) {
    throw new HttpsError('permission-denied', 'Please verify your mobile number again.');
  }
  const newPassword = checkPassword(request.data?.newPassword);
  const rec = await admin.auth().getUser(request.auth.uid);
  if (!rec.email) {
    throw new HttpsError(
      'failed-precondition',
      'This account has no email yet, so it has no password. Please log in with your phone OTP.'
    );
  }
  await admin.auth().updateUser(request.auth.uid, { password: newPassword });
  return { success: true, email: rec.email };
});