import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { AuthShell, Title, Subtitle, Field, OtpField, PrimaryButton, LinkText, useCountdown, BRAND } from '../authUi';
import { EMAIL_RE, PHONE_RE, authErrorMessage, setAuthRoutingPaused } from '../authFlow';

// Forgot password, two ways:
//  1) Email  -> 6-digit code sent to the email -> new password
//  2) Mobile -> OTP by SMS -> new password
type Tab = 'email' | 'phone';
type Step = 'enter' | 'code' | 'newpass';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('email');
  const [step, setStep] = useState<Step>('enter');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [conf, setConf] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const { left, start } = useCountdown(45);

  const emailNorm = email.trim().toLowerCase();
  const tempSession = useRef(false); // true while a phone sign-in made only for this reset is active

  // Leaving the screen in any way: end the temporary session and restore normal routing
  useEffect(() => {
    return () => {
      if (tempSession.current) auth().signOut().catch(() => {});
      setAuthRoutingPaused(false);
    };
  }, []);

  const reset = (t: Tab) => {
    setTab(t);
    setStep('enter');
    setCode('');
    setPass('');
    setPass2('');
    setConf(null);
  };

  const goLogin = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Login');
  };

  const onBack = () => {
    if (loading) return;
    if (step !== 'enter') {
      // A phone sign-in may be half done. Make sure routing is back to normal.
      if (tab === 'phone') cancelPhoneSession();
      reset(tab);
      return;
    }
    goLogin();
  };

  // ───────── EMAIL ─────────
  const sendEmail = async () => {
    if (!EMAIL_RE.test(emailNorm)) return Alert.alert('Invalid Email', 'Please enter a valid email address.');
    setLoading(true);
    try {
      await functions().httpsCallable('sendEmailCode')({ email: emailNorm, purpose: 'reset' });
      setStep('code');
      setCode('');
      start();
    } catch (e: any) {
      Alert.alert('Could Not Send Code', authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submitEmailReset = async () => {
    if (code.length !== 6) return Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
    if (pass.length < 6) return Alert.alert('Weak Password', 'Password should be at least 6 characters long.');
    if (pass !== pass2) return Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
    setLoading(true);
    try {
      await functions().httpsCallable('resetPasswordWithEmailCode')({ email: emailNorm, code, newPassword: pass });
      Alert.alert('Password Changed', 'Your password has been updated. Please log in with your new password.', [
        { text: 'OK', onPress: goLogin },
      ]);
    } catch (e: any) {
      Alert.alert('Could Not Reset Password', authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // ───────── PHONE ─────────
  const cancelPhoneSession = async () => {
    tempSession.current = false;
    try {
      if (auth().currentUser) await auth().signOut();
    } catch {}
    setAuthRoutingPaused(false);
  };

  const sendPhone = async () => {
    if (!PHONE_RE.test(phone)) return Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number.');
    setLoading(true);
    try {
      setAuthRoutingPaused(true); // confirming the OTP signs in; do not open the app
      const c = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConf(c);
      setStep('code');
      setCode('');
      start();
    } catch (e: any) {
      setAuthRoutingPaused(false);
      Alert.alert('Could Not Send OTP', authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const confirmPhone = async () => {
    if (!conf) return;
    if (code.length !== 6) return Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
    setLoading(true);
    try {
      let cred: FirebaseAuthTypes.UserCredential | null = null;
      try {
        cred = await conf.confirm(code);
      } catch (err: any) {
        // Android may already have verified the SMS automatically
        const u = auth().currentUser;
        if (!u || u.phoneNumber !== `+91${phone}`) throw err;
        const isNew = !!u.metadata.creationTime && u.metadata.creationTime === u.metadata.lastSignInTime;
        cred = { user: u, additionalUserInfo: { isNewUser: isNew } } as any;
      }
      tempSession.current = true;
      if (cred?.additionalUserInfo?.isNewUser) {
        // This number has no ECC account. Remove the empty account we just created.
        try {
          await cred!.user.delete();
          tempSession.current = false;
        } catch {
          await auth().signOut();
        }
        setAuthRoutingPaused(false);
        setLoading(false);
        Alert.alert('No Account Found', 'No ECC account is linked to this mobile number. Please sign up first.');
        reset('phone');
        return;
      }
      setStep('newpass');
    } catch (e: any) {
      Alert.alert('Verification Failed', authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submitPhoneReset = async () => {
    if (pass.length < 6) return Alert.alert('Weak Password', 'Password should be at least 6 characters long.');
    if (pass !== pass2) return Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
    setLoading(true);
    try {
      const res: any = await functions().httpsCallable('resetPasswordWithPhone')({ newPassword: pass });
      const mail = res?.data?.email || '';
      await cancelPhoneSession();
      Alert.alert('Password Changed', `Your password has been updated. Log in with ${mail || 'your email'} and the new password.`, [
        { text: 'OK', onPress: goLogin },
      ]);
    } catch (e: any) {
      Alert.alert('Could Not Reset Password', authErrorMessage(e));
      // If the account has no email, nothing can be reset: end the temporary session
      if (e?.code === 'functions/failed-precondition' || e?.code === 'failed-precondition') {
        await cancelPhoneSession();
        reset('phone');
      }
    } finally {
      setLoading(false);
    }
  };

  // ───────── UI ─────────
  const resendDisabled = left > 0 || loading;

  return (
    <AuthShell onBack={onBack} bg="#E0F2FE" orbA="#BAE6FD" orbB="#E9D5FF">
      <Title>Forgot Password?</Title>
      <Subtitle>
        {step === 'enter' && 'We will send a verification code to your email or mobile number.'}
        {step === 'code' && tab === 'email' && `Enter the 6-digit code sent to ${emailNorm} and choose a new password.`}
        {step === 'code' && tab === 'phone' && `Enter the 6-digit OTP sent to +91 ${phone}.`}
        {step === 'newpass' && 'Mobile verified. Choose your new password.'}
      </Subtitle>

      {step === 'enter' && (
        <View style={st.tabs}>
          {(['email', 'phone'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => reset(t)} disabled={loading} activeOpacity={0.8}>
              <Text style={[st.tabText, tab === t && st.tabTextOn]}>{t === 'email' ? 'Email' : 'Mobile'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* EMAIL */}
      {tab === 'email' && step === 'enter' && (
        <>
          <Field placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          <PrimaryButton title="Send Code" onPress={sendEmail} loading={loading} />
        </>
      )}
      {tab === 'email' && step === 'code' && (
        <>
          <OtpField value={code} onChangeText={setCode} editable={!loading} />
          <Field placeholder="New password" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" editable={!loading} />
          <Field placeholder="Confirm new password" value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" editable={!loading} />
          <PrimaryButton title="Reset Password" onPress={submitEmailReset} loading={loading} />
          <LinkText title={left > 0 ? `Resend code in ${left}s` : 'Resend code'} onPress={sendEmail} disabled={resendDisabled} />
        </>
      )}

      {/* PHONE */}
      {tab === 'phone' && step === 'enter' && (
        <>
          <Field
            prefix="+91"
            placeholder="Enter mobile number"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!loading}
          />
          <PrimaryButton title="Get OTP Code" onPress={sendPhone} loading={loading} />
        </>
      )}
      {tab === 'phone' && step === 'code' && (
        <>
          <OtpField value={code} onChangeText={setCode} editable={!loading} />
          <PrimaryButton title="Verify OTP" onPress={confirmPhone} loading={loading} disabled={code.length !== 6} />
          <LinkText title={left > 0 ? `Resend OTP in ${left}s` : 'Resend OTP'} onPress={sendPhone} disabled={resendDisabled} />
        </>
      )}
      {tab === 'phone' && step === 'newpass' && (
        <>
          <Field placeholder="New password" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" editable={!loading} />
          <Field placeholder="Confirm new password" value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" editable={!loading} />
          <PrimaryButton title="Reset Password" onPress={submitPhoneReset} loading={loading} />
        </>
      )}
    </AuthShell>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 26, padding: 4, marginBottom: 16 },
  tab: { flex: 1, height: 40, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tabOn: { backgroundColor: BRAND },
  tabText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  tabTextOn: { color: '#FFFFFF' },
});