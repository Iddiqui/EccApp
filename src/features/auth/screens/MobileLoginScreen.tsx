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
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

export default function MobileLoginScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSendOTP = () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid mobile number.');
      return;
    }
    Alert.alert('OTP Sent', `Verification code sent to +91 ${phoneNumber}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />

      {/* Aesthetic Mesh Gradient Orbs (Background Glow Effects) */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      {/* Floating Header Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Exact Vertical & Horizontal Centering Container */}
      <View style={styles.centerContainer}>
        {/* Glossy Card Section */}
        <View style={styles.cardContainer}>
          {/* Title & Subtitle */}
          <Text style={styles.title}>Mobile Login</Text>
          <Text style={styles.subtitle}>
            Enter your mobile number to get a verification OTP code.
          </Text>

          {/* Input Box */}
          <View style={styles.inputContainer}>
            <Text style={styles.countryCode}>+91</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="Enter mobile number"
              placeholderTextColor="#94A3B8"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSendOTP}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Get OTP Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#EEF2FF', // Base Aesthetic Soft Lavender Color
    position: 'relative',
    overflow: 'hidden',
  },
  // Top-Right Soft Glow Orb
  orbTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#C7D2FE',
    opacity: 0.6,
  },
  // Bottom-Left Magenta/Purple Soft Glow Orb
  orbBottomLeft: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center', // Exact Center Alignment
    alignItems: 'center',
    paddingHorizontal: 20,
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
    fontSize: 30, 
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
  countryCode: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#0F172A', 
    marginRight: 10 
  },
  divider: {
    width: 1.5,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginRight: 12,
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