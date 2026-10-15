import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

// src/features/auth/useProfileGate.ts
//
// Decides whether a signed-in user must fill the "Complete your profile" form.
//  - Creates the users/{uid} document the first time a user signs in (any method).
//  - New documents start with profileComplete:false.
//  - Old users (document exists without the field) are NOT forced to fill the form.

// false: only NEW accounts (document created by this gate, or profileComplete:false) see the form.
// true : every user whose profile is not marked complete sees the form, old users included.
//        Turn this on only after the email code (SMTP) works, or old users get stuck on the form.
const REQUIRE_FOR_EXISTING_USERS = false;

export type GateState = 'loading' | 'ready' | 'needsProfile';

export function useProfileGate(user: { uid: string; email?: string | null; displayName?: string | null; phoneNumber?: string | null } | null): GateState {
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    if (!user) {
      setState('loading');
      return;
    }
    setState('loading');
    const ref = firestore().collection('users').doc(user.uid);
    let creating = false;

    const createBase = async () => {
      if (creating) return;
      creating = true;
      try {
        await ref.set(
          {
            uid: user.uid,
            fullName: user.displayName || '',
            email: (user.email || '').toLowerCase(),
            phone: user.phoneNumber ? user.phoneNumber.replace(/^\+91/, '') : '',
            role: 'user',
            streak: 0,
            speakingScore: 0,
            fluency: 0,
            profileComplete: false,
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        // If creating fails (offline), do not lock the user out of the app
        console.warn('Profile gate: could not create the user document', e);
        setState('ready');
      }
    };

    const unsub = ref.onSnapshot(
      (snap) => {
        const d: any = snap.exists() ? snap.data() || {} : null;

        // No document yet
        if (!d) {
          createBase();
          return;
        }
        if (d.profileComplete === true) {
          setState('ready');
          return;
        }
        if (d.profileComplete === false) {
          setState('needsProfile');
          return;
        }
        // The field is missing. A real old account always has createdAt / fullName.
        // A document with neither was created by a side write (for example the push token
        // saved right after login). Treat it as a brand-new account.
        const looksEmpty = !d.createdAt && !d.fullName && !d.uid;
        if (looksEmpty) {
          createBase();
          return;
        }
        setState(REQUIRE_FOR_EXISTING_USERS ? 'needsProfile' : 'ready');
      },
      () => setState('ready')
    );
    return unsub;
  }, [user?.uid]);

  return state;
}