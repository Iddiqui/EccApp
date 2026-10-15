import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { AuthShell, Title, Subtitle, Field, OtpField, PrimaryButton, SmallButton, LinkText, Label, useCountdown, BRAND } from '../authUi';
import { PHONE_RE, EMAIL_RE, authErrorMessage } from '../authFlow';

// Shown once, right after the first sign-in (email, Google or mobile OTP).
// The user fills name, age, gender, verifies mobile + email, and sets a password.
// AppNavigator hides every other screen until `profileComplete` becomes true.

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

export default function CompleteProfileScreen() {
  const current = auth().currentUser;

  const [fullName, setFullName] = useState(current?.displayName || '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  // ── Mobile ──
  const [phoneVerified, setPhoneVerified] = useState(!!current?.phoneNumber);
  const [phoneE164, setPhoneE164] = useState(current?.phoneNumber || '');
  const [phone, setPhone] = useState('');
  const [phoneVid, setPhoneVid] = useState(''); // verification id of the SMS that was sent ('' = no SMS sent yet)
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const phoneTimer = useCountdown(30);

  // ── Email ──
  const hasPasswordLogin = !!current?.providerData?.some((p) => p?.providerId === 'password');
  const [email, setEmail] = useState(current?.email || '');
  const [emailVerified, setEmailVerified] = useState(!!current?.email && !!current?.emailVerified);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const emailTimer = useCountdown(45);

  // ── Password ──
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [saving, setSaving] = useState(false);
  const savedPassword = useRef('');

  // Android can verify the SMS automatically; the phone then appears on the user without
  // the code being typed. Listen for it.
  useEffect(() => {
    return auth().onUserChanged((u) => {
      if (u?.phoneNumber) {
        setPhoneVerified(true);
        setPhoneE164(u.phoneNumber);
        setPhoneVid('');
      }
    });
  }, []);

  const emailNorm = email.trim().toLowerCase();
  const needPassword = !hasPasswordLogin || emailNorm !== (current?.email || '').toLowerCase();

  // ───────── mobile OTP (link the number to this account) ─────────
  // The native Firebase SDK cannot use linkWithPhoneNumber(). The supported way is:
  // verifyPhoneNumber() -> verification id -> PhoneAuthProvider.credential() -> linkWithCredential().
  const linkWithCode = async (vid: string, code: string) => {
    const u = auth().currentUser;
    if (!u) throw new Error('Please log in again.');
    const credential = auth.PhoneAuthProvider.credential(vid, code);
    await u.linkWithCredential(credential);
    await auth().currentUser?.reload();
    setPhoneE164(auth().currentUser?.phoneNumber || `+91${phone}`);
    setPhoneVerified(true);
    setPhoneVid('');
  };

  const sendPhoneOtp = async () => {
    if (!PHONE_RE.test(phone)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneBusy(true);
    try {
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          fn();
        };
        auth()
          .verifyPhoneNumber(`+91${phone}`, 30, phoneVid !== '')
          .on(
            'state_changed',
            (snap: any) => {
              if (snap.state === 'sent') {
                setPhoneVid(snap.verificationId);
                setPhoneCode('');
                phoneTimer.start();
                finish(resolve);
              } else if (snap.state === 'timeout') {
                // Auto-read of the SMS timed out. The code is still valid, so keep what the user typed.
                if (!done) setPhoneVid(snap.verificationId);
              } else if (snap.state === 'verified') {
                // Android read the SMS by itself
                setPhoneVid(snap.verificationId);
                if (snap.code) linkWithCode(snap.verificationId, snap.code).catch(() => {});
                finish(resolve);
              } else if (snap.state === 'error') {
                finish(() => reject(snap.error));
              }
            },
            (err: any) => finish(() => reject(err))
          );
      });
    } catch (e: any) {
      Alert.alert('Could Not Send OTP', authErrorMessage(e));
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmPhoneOtp = async () => {
    if (!phoneVid) return;
    if (phoneCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }
    setPhoneBusy(true);
    try {
      await linkWithCode(phoneVid, phoneCode);
    } catch (e: any) {
      Alert.alert('Verification Failed', authErrorMessage(e));
    } finally {
      setPhoneBusy(false);
    }
  };

  // ───────── email code ─────────
  const sendEmailCode = async () => {
    if (!EMAIL_RE.test(emailNorm)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setEmailBusy(true);
    try {
      await functions().httpsCallable('sendEmailCode')({ email: emailNorm, purpose: 'verify' });
      setEmailSent(true);
      setEmailCode('');
      emailTimer.start();
    } catch (e: any) {
      Alert.alert('Could Not Send Code', authErrorMessage(e));
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmEmailCode = async () => {
    if (emailCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }
    setEmailBusy(true);
    try {
      await functions().httpsCallable('verifyEmailCode')({ email: emailNorm, code: emailCode });
      setEmailVerified(true);
      setEmailSent(false);
    } catch (e: any) {
      Alert.alert('Verification Failed', authErrorMessage(e));
    } finally {
      setEmailBusy(false);
    }
  };

  const onEmailChange = (t: string) => {
    setEmail(t);
    // Changing the address cancels any earlier verification
    if (emailVerified && t.trim().toLowerCase() !== emailNorm) setEmailVerified(false);
    if (emailSent) setEmailSent(false);
  };

  // ───────── save ─────────
  const submit = async () => {
    const ageNum = parseInt(age, 10);
    if (fullName.trim().length < 2) return Alert.alert('Missing Name', 'Please enter your full name.');
    if (!ageNum || ageNum < 10 || ageNum > 100) return Alert.alert('Invalid Age', 'Please enter a valid age (10 to 100).');
    if (!gender) return Alert.alert('Missing Gender', 'Please choose your gender.');
    if (!phoneVerified) return Alert.alert('Verify Mobile', 'Please verify your mobile number with the OTP.');
    if (!emailVerified) return Alert.alert('Verify Email', 'Please verify your email address with the code.');
    if (needPassword) {
      if (password.length < 6) return Alert.alert('Weak Password', 'Password should be at least 6 characters long.');
      if (password !== confirm) return Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
    }

    setSaving(true);
    try {
      await functions().httpsCallable('completeProfile')({
        fullName: fullName.trim(),
        age: ageNum,
        gender,
        email: emailNorm,
        password: needPassword ? password : undefined,
      });
      savedPassword.current = needPassword ? password : '';

      // Changing the password / email can end the current session. Refresh it, or sign in
      // again with the new credentials, so the user stays logged in.
      try {
        await auth().currentUser?.getIdToken(true);
      } catch {
        if (savedPassword.current) {
          await auth().signInWithEmailAndPassword(emailNorm, savedPassword.current);
        } else {
          Alert.alert('Profile Saved', 'Please log in again to continue.');
          await auth().signOut();
        }
      }
      // The navigator sees profileComplete = true and opens the app.
    } catch (e: any) {
      Alert.alert('Could Not Save', authErrorMessage(e));
      setSaving(false);
    }
  };

  const logout = () => {
    Alert.alert('Log Out', 'Do you want to log out? You can finish your profile later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => auth().signOut() },
    ]);
  };

  const busy = saving;

  return (
    <AuthShell>
      <Title>Complete Your Profile</Title>
      <Subtitle>Just a few details so we can set up your ECC account.</Subtitle>

      <Label>Full name</Label>
      <Field placeholder="Your full name" value={fullName} onChangeText={setFullName} editable={!busy} />

      <Label>Age</Label>
      <Field
        placeholder="Your age"
        value={age}
        onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        editable={!busy}
      />

      <Label>Gender</Label>
      <View style={st.genderRow}>
        {GENDERS.map((g) => {
          const on = gender === g.key;
          return (
            <TouchableOpacity key={g.key} style={[st.chip, on && st.chipOn]} onPress={() => setGender(g.key)} disabled={busy} activeOpacity={0.8}>
              <Text style={[st.chipText, on && st.chipTextOn]}>{g.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mobile number */}
      <Label>Mobile number</Label>
      {phoneVerified ? (
        <Field value={phoneE164.replace(/^\+91/, '')} prefix="+91" locked badge="✓ Verified" editable={false} />
      ) : !phoneVid ? (
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Field
              prefix="+91"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              editable={!phoneBusy && !busy}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <SmallButton title="Send OTP" onPress={sendPhoneOtp} loading={phoneBusy} disabled={busy} />
          </View>
        </View>
      ) : (
        <>
          <Text style={st.hint}>Code sent to +91 {phone}</Text>
          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <OtpField value={phoneCode} onChangeText={setPhoneCode} editable={!phoneBusy} />
            </View>
            <View style={{ marginBottom: 12 }}>
              <SmallButton title="Verify" onPress={confirmPhoneOtp} loading={phoneBusy} disabled={phoneCode.length !== 6} />
            </View>
          </View>
          <View style={st.linksRow}>
            <LinkText title={phoneTimer.left > 0 ? `Resend in ${phoneTimer.left}s` : 'Resend OTP'} onPress={sendPhoneOtp} disabled={phoneTimer.left > 0 || phoneBusy} />
            <LinkText title="Change number" onPress={() => setPhoneVid('')} disabled={phoneBusy} />
          </View>
        </>
      )}

      {/* Email */}
      <Label>Email address</Label>
      {emailVerified ? (
        <Field value={email} locked badge="✓ Verified" editable={false} />
      ) : !emailSent ? (
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Field
              placeholder="you@example.com"
              value={email}
              onChangeText={onEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!emailBusy && !busy}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <SmallButton title="Send Code" onPress={sendEmailCode} loading={emailBusy} disabled={busy} />
          </View>
        </View>
      ) : (
        <>
          <Text style={st.hint}>Code sent to {emailNorm}. Check your inbox (and spam).</Text>
          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <OtpField value={emailCode} onChangeText={setEmailCode} editable={!emailBusy} />
            </View>
            <View style={{ marginBottom: 12 }}>
              <SmallButton title="Verify" onPress={confirmEmailCode} loading={emailBusy} disabled={emailCode.length !== 6} />
            </View>
          </View>
          <View style={st.linksRow}>
            <LinkText title={emailTimer.left > 0 ? `Resend in ${emailTimer.left}s` : 'Resend code'} onPress={sendEmailCode} disabled={emailTimer.left > 0 || emailBusy} />
            <LinkText title="Change email" onPress={() => setEmailSent(false)} disabled={emailBusy} />
          </View>
        </>
      )}

      {/* Password (only when the account has no password yet, or the email changed) */}
      {needPassword ? (
        <>
          <Label>{hasPasswordLogin ? 'Password for the new email' : 'Create a password'}</Label>
          <Field placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!busy} />
          <Field placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" editable={!busy} />
        </>
      ) : null}

      <PrimaryButton title="Save & Continue" onPress={submit} loading={saving} />
      <LinkText title="Log out" onPress={logout} disabled={saving} />
    </AuthShell>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  linksRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748B', marginLeft: 8, marginBottom: 6, fontWeight: '500' },
  genderRow: { flexDirection: 'row', marginBottom: 12 },
  chip: {
    flex: 1, height: 46, borderRadius: 23, backgroundColor: '#F8FAFC', borderWidth: 1.2, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 4,
  },
  chipOn: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  chipTextOn: { color: '#FFFFFF' },
});