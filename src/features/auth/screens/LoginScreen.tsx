import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import { LIGHT_THEME as THEME } from '../../../hooks/useTheme'; // Sahi path: teen baar '../' aayega/ Theme import kiya

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Password state add ki

  const handleLogin = () => {
    // TabNavigator par navigate karne ke liye standard route name 'TabNavigator' ya 'Home' hota hai
    if (email.length > 0 && password.length > 0) {
     navigation.replace('Dashboard');// Aapke setup ke hisab se 'TabNavigator' par bhej rahe hain
    } else {
      Alert.alert("Error", "Please enter email and password");
    }
  };

  return (
    <View style={styles.container}>
      {/* Welcome Heading */}
      <Text style={styles.heading}>Welcome Back</Text>

      {/* Email Input */}
      <Text style={styles.label}>Email Address</Text>
      <TextInput 
        placeholder="Enter your email" 
        placeholderTextColor={THEME.colors.textSecondary}
        onChangeText={setEmail} 
        value={email}
        style={styles.input} 
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* Password Input */}
      <Text style={styles.label}>Password</Text>
      <TextInput 
        placeholder="Enter your password" 
        placeholderTextColor={THEME.colors.textSecondary}
        onChangeText={setPassword} 
        value={password}
        style={styles.input} 
        secureTextEntry={true} // Password chhipane ke liye
        autoCapitalize="none"
      />

      {/* Login Button */}
      <TouchableOpacity onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24,
    backgroundColor: THEME.colors.bgLight // Background ko clean light kiya
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  input: { 
    height: 50,
    borderWidth: 1, 
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    marginBottom: 20, 
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.bgCard,
    color: THEME.colors.textPrimary, // FIX: Isse typing wala text hamesha dark dikhega!
    fontSize: 15
  },
  button: { 
    backgroundColor: '#4F5E8C', // Aapki screenshot wala button color
    padding: 16,
    borderRadius: THEME.radius.md,
    marginTop: 10,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: { 
    color: 'white', 
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1
  }
});