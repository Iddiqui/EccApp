import React, { useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { AuthShell, Title, Subtitle, Field, OtpField, PrimaryButton, LinkText, useCountdown } from '../authUi';
import { PHONE_RE, authErrorMessage } from '../authFlow';

// Login with a mobile number + OTP (Firebase Phone Auth).
// After the OTP is confirmed the user is signed in; AppNavigator then decides between
// Home (existing user) and Complete Profile (new user).
export default function MobileLoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { left, start } = useCountdown(30);

  const sendOtp = async () => {
    if (!PHONE_RE.test(phone)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const c = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirmation(c);
      setCode('');
      start();
    } catch (e: any) {
      Alert.alert('Could Not Send OTP', authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!confirmation) return;
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await confirmation.confirm(code);
      // Signed in. The navigator takes over from here.
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Verification Failed', authErrorMessage(e));
    }
  };

  const back = () => {
    if (confirmation) {
      setConfirmation(null);
      setCode('');
    } else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Login');
  };

  return (
    <AuthShell onBack={back}>
      {!confirmation ? (
        <>
          <Title>Mobile Login</Title>
          <Subtitle>Enter your mobile number to get a verification OTP code.</Subtitle>
          <Field
            prefix="+91"
            placeholder="Enter mobile number"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!loading}
          />
          <PrimaryButton title="Get OTP Code" onPress={sendOtp} loading={loading} />
        </>
      ) : (
        <>
          <Title>Verify OTP</Title>
          <Subtitle>We sent a 6-digit code to +91 {phone}.</Subtitle>
          <OtpField value={code} onChangeText={setCode} editable={!loading} />
          <PrimaryButton title="Verify & Continue" onPress={verifyOtp} loading={loading} disabled={code.length !== 6} />
          <LinkText
            title={left > 0 ? `Resend code in ${left}s` : 'Resend code'}
            onPress={sendOtp}
            disabled={left > 0 || loading}
          />
          <LinkText title="Change number" onPress={back} disabled={loading} />
        </>
      )}
      <View style={st.note}>
        <Text style={st.noteText}>New here? Your account is created automatically after verification.</Text>
      </View>
    </AuthShell>
  );
}

const st = StyleSheet.create({
  note: { marginTop: 10 },
  noteText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', fontWeight: '500' },
});