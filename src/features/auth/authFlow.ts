// src/features/auth/authFlow.ts
//
// A tiny switch that lets a screen run a sign-in WITHOUT the navigator reacting to it.
// Used by "Forgot password -> mobile OTP": confirming the OTP signs the user in for a
// moment, but we do not want the app to jump to Home; we only need a fresh token to
// set the new password and then sign out again.

let paused = false;

export const setAuthRoutingPaused = (v: boolean) => {
  paused = v;
};

export const isAuthRoutingPaused = () => paused;

/** Maps Firebase / callable errors to friendly English messages. */
export function authErrorMessage(e: any): string {
  const code: string = e?.code || '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'This mobile number is not valid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for now. Please try again later.';
    case 'auth/invalid-verification-code':
      return 'Incorrect code. Please check it and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Please request a new one.';
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'This mobile number is already linked to another account.';
    case 'auth/provider-already-linked':
      return 'A mobile number is already linked to this account.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your network.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/requires-recent-login':
      return 'Please log in again and retry.';
    case 'auth/missing-client-identifier':
    case 'auth/app-not-authorized':
      return 'Phone verification is not set up for this build yet. Please contact support.';
  }
  const msg: string = e?.message || '';
  // Callable errors carry our own readable message ("[functions/...] text")
  const clean = msg.replace(/^\[[^\]]+\]\s*/, '');
  return clean || 'Something went wrong. Please try again.';
}

export const PHONE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;