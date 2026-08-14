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
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { ArrowLeft, Mail } from 'lucide-react-native';
import auth from '@react-native-firebase/auth';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await auth().sendPasswordResetEmail(email.trim());
      Alert.alert(
        'Email Sent! 📧',
        'Password reset link has been sent to your email.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E0F2FE" />

      {/* Unique Aesthetic Cyan & Violet Mesh Orbs */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      {/* Header Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          disabled={loading}
        >
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Keyboard Responsive Wrapper */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Center Wrapper */}
          <View style={styles.centerContainer}>
            {/* Glossy Card Container */}
            <View style={styles.cardContainer}>
              
              {/* Title & Subtitle */}
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your registered email address below to receive a password reset link.
              </Text>

              {/* Premium Input */}
              <View style={styles.inputContainer}>
                <Mail size={20} color="#5356FF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              {/* Primary Action Button */}
              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.75 }]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
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
    backgroundColor: '#E0F2FE', // Base Soft Cyan-Sky Aesthetic Tint
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
    backgroundColor: '#BAE6FD',
    opacity: 0.7,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E9D5FF',
    opacity: 0.8,
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
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    zIndex: 5,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 22,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#0F172A', 
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#64748B', 
    textAlign: 'center',
    lineHeight: 18, 
    marginBottom: 26,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    paddingHorizontal: 20,
    height: 54,
    marginBottom: 20,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  inputIcon: { 
    marginRight: 12 
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: '#0F172A',
    fontWeight: '600',
  },
  button: {
    height: 54,
    backgroundColor: '#5356FF',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '800' 
  },
});