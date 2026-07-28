import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

export default function RegisterScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();

  // Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation & Registration Logic
  const handleRegister = async () => {
    // 1. Basic Empty Validation
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

    // 2. Password Matching Validation
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
      return;
    }

    // 3. Password Minimum Length Check
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Step A: Firebase Auth User Creation
      const userCredential = await auth().createUserWithEmailAndPassword(
        email.trim(),
        password,
      );

      const user = userCredential.user;

      // Update User Display Name in Firebase Auth
      await user.updateProfile({
        displayName: fullName.trim(),
      });

      // Step B: Save Extra Details in Firestore 'users' Collection
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

      // OnAuthStateChanged handles navigation, but explicit replace fallback:
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#F4F7FC' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="#F4F7FC"
      />

      {/* Top Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack && navigation.goBack()}
        disabled={loading}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Main Title & Subtitle */}
        <Text style={styles.heading}>Create{'\n'}Account</Text>
        <Text style={styles.subtitle}>Join ECC and start learning today.</Text>

        {/* Full Name Input */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Full Name"
            placeholderTextColor="#A0AEC0"
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
            placeholderTextColor="#A0AEC0"
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
            placeholderTextColor="#A0AEC0"
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
            placeholderTextColor="#A0AEC0"
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
            placeholderTextColor="#A0AEC0"
            secureTextEntry={true}
            autoCapitalize="none"
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />
        </View>

        {/* Create Account Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Navigation Link */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            disabled={loading}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  backArrow: {
    fontSize: 20,
    color: '#2D3748',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  heading: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  inputContainer: {
    backgroundColor: '#EBF0F7',
    borderRadius: 30,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#4F46E5',
    height: 56,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 12,
    marginBottom: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  loginLink: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});