import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme'; 

export default function RegisterScreen({ navigation }: any) {
  const themeHook = useTheme() as any;
  const isDarkMode = themeHook?.isDarkMode || false;

  // Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 1-Click Instant Back
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  };

  // Registration Logic
  const handleRegister = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !mobileNumber.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Missing Fields', 'Please fill in all the required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await auth().createUserWithEmailAndPassword(
        email.trim(),
        password,
      );

      const user = userCredential.user;

      await user.updateProfile({
        displayName: fullName.trim(),
      });

      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          uid: user.uid,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: mobileNumber.trim(),
          role: 'user',
          streak: 0,
          speakingScore: 0,
          fluency: 0,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      setLoading(false);
      navigation.replace('Dashboard');
    } catch (error: any) {
      setLoading(false);

      let errorMessage = 'Something went wrong. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'That email address is already in use!';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'That email address is invalid!';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }

      Alert.alert('Registration Failed', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="#EEF2FF"
      />

      {/* Aesthetic Background Mesh Orbs */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      {/* Top Header Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.75}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          disabled={loading}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Keyboard Responsive Wrapper */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          
          {/* Glossy Floating Card Section */}
          <View style={styles.cardContainer}>
            
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subtitle}>Join ECC and start learning today.</Text>

            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>

            {/* Email Address Input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Email Address"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            {/* Mobile Number Input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Mobile Number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                style={styles.input}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
                autoCapitalize="none"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
                autoCapitalize="none"
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />
            </View>

            {/* Primary Create Account Button */}
            <TouchableOpacity
              style={[styles.createButton, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Footer Link */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={loading}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF', // Aesthetic Base Background
    position: 'relative',
    overflow: 'hidden',
  },
  orbTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: '#C7D2FE',
    opacity: 0.6,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: '#DDD6FE',
    opacity: 0.7,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  backArrow: {
    fontSize: 22,
    color: '#1E293B',
    fontWeight: '800',
    transform: [{ translateY: -1 }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
    justifyContent: 'center',
    zIndex: 5,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 20,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  heading: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  input: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#5356FF',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  loginLink: {
    color: '#5356FF',
    fontSize: 14,
    fontWeight: '800',
  },
});