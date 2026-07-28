import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  Alert, 
  StyleSheet, 
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Platform
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin'; 
import { useTheme } from '../../../hooks/useTheme'; 

const WEB_CLIENT_ID = '297316222035-vg3fuee2jrfff4076jfh9qnr2nd3q05q.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
  scopes: ['profile', 'email'], 
});

export default function LoginScreen({ navigation }: any) {
  const { theme, isDarkMode } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);

// Direct 1-Click Go Back to Onboarding
const handleBackPress = () => {
  // Option 1: Standard Navigation (Stack Duplicate nahi hone dega)
  navigation.navigate('Onboarding');
};

  const handleLogin = async () => {
    if (email.trim().length === 0 || password.length === 0) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
      setLoading(false);
      navigation.replace('Dashboard');
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Authentication Failed", "Invalid email or password.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Safe to ignore
      }

      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        offlineAccess: true,
      });

      const response = await GoogleSignin.signIn();
      
      let idToken = null;
      let accessToken = null;

      if (response) {
        const rawResponse = response as any;
        if (rawResponse.data) {
          idToken = rawResponse.data.idToken;
          accessToken = rawResponse.data.tokens?.accessToken || rawResponse.data.accessToken;
        } else {
          idToken = rawResponse.idToken || rawResponse.tokens?.idToken;
          accessToken = rawResponse.accessToken || rawResponse.tokens?.accessToken;
        }
      }

      if (!idToken) {
        setLoading(false);
        Alert.alert("Handshake Error", "Could not fetch authentication token from Google.");
        return;
      }

      const finalAccessToken = accessToken && accessToken.trim().length > 0 ? accessToken : 'MOCK_TOKEN_VALIDATION_BYPASS';
      const googleCredential = auth.GoogleAuthProvider.credential(idToken, finalAccessToken);
      
      const userCredential = await auth().signInWithCredential(googleCredential);
      const user = userCredential.user;

      if (user) {
        try {
          await firestore()
            .collection('users')
            .doc(user.uid)
            .set({
              uid: user.uid,
              fullName: user.displayName || 'Google User',
              email: user.email,
              phone: user.phoneNumber || '',
              role: 'user',
              streak: 0,           
              speakingScore: 0,
              fluency: 0,
              createdAt: new Date().toISOString()
            }, { merge: true });

        } catch (dbError: any) {
          Alert.alert("Database Write Error", dbError?.message || "Firestore insertion failed");
          setLoading(false);
          return;
        }
      }
      
      setLoading(false);
      navigation.replace('Dashboard');
    } catch (error: any) {
      setLoading(false);
      const nativeMessage = error?.message ? String(error.message) : 'System architecture signature conflict';
      const nativeCode = error?.code ? String(error.code) : 'Unknown Native Code';
      
      Alert.alert("OAuth Native Exception", `Details: ${nativeMessage}\nCode: ${nativeCode}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor="#F8FAFC" />
      
      {/* Top Header - Perfect Top Clearance & Alignment */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackPress}
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={styles.backArrow}>←</Text>
          
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Title */}
        <Text style={styles.heading}>Welcome{'\n'}Back</Text>

        {/* Username / Email Input */}
        <View style={styles.inputContainer}>
          <TextInput 
            placeholder="Username / Email" 
            placeholderTextColor="#A0AEC0"
            onChangeText={setEmail} 
            value={email}
            style={styles.input} 
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <TextInput 
            placeholder="Password" 
            placeholderTextColor="#A0AEC0"
            onChangeText={setPassword} 
            value={password}
            style={styles.input} 
            secureTextEntry={true} 
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Forgot Password Link */}
        <TouchableOpacity 
          style={styles.forgotPassContainer}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotPassText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity 
          onPress={handleLogin} 
          style={[styles.loginButton, loading && { opacity: 0.7 }]}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Continue with Google Button */}
        <TouchableOpacity 
          onPress={handleGoogleLogin} 
          style={[styles.socialButton, loading && { opacity: 0.6 }]}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.socialButtonText}>Continue with </Text>
          <Text style={styles.googleBrandText}>
            <Text style={{ color: '#4285F4' }}>G</Text>
            <Text style={{ color: '#EA4335' }}>o</Text>
            <Text style={{ color: '#FBBC05' }}>o</Text>
            <Text style={{ color: '#4285F4' }}>g</Text>
            <Text style={{ color: '#34A853' }}>l</Text>
            <Text style={{ color: '#EA4335' }}>e</Text>
          </Text>
        </TouchableOpacity>

        {/* Continue with Phone Button */}
        <TouchableOpacity 
          style={styles.socialButton}
          onPress={() => navigation.navigate('MobileLogin')}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.socialButtonText}>Continue with </Text>
          <Text style={styles.phoneIcon}>📱</Text>
        </TouchableOpacity>

        {/* Register Redirect */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC'
  },
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
 backButton: {
  width: 44,
  height: 44,
  borderRadius: 22, // 👈 Perfect round circle
  backgroundColor: '#FFFFFF',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
},
backArrow: {
  fontSize: 30,
  color: '#1E293B',
  fontWeight: '700',
  textAlign: 'center',
  includeFontPadding: false, // 👈 Extra font space hatayega
  transform: [{ translateY: -3 }], // 👈 Sirf Arrow ko circle ke andar vertical center karega
},
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heading: { 
    fontSize: 34, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginTop: 12,
    marginBottom: 28,
    color: '#0F172A',
    lineHeight: 40
  },
  inputContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: { 
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  forgotPassContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPassText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: { 
    backgroundColor: '#5356FF', 
    height: 56, 
    borderRadius: 30, 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  loginButtonText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 17, 
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  dividerLine: { 
    flex: 1, 
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  dividerText: { 
    paddingHorizontal: 12, 
    fontSize: 12, 
    fontWeight: '700',
    color: '#94A3B8'
  },
  socialButton: { 
    backgroundColor: '#F1F5F9', 
    height: 54, 
    borderRadius: 30, 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  socialButtonText: { 
    fontSize: 15, 
    fontWeight: '600',
    color: '#475569',
  },
  googleBrandText: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 4,
  },
  phoneIcon: {
    fontSize: 20,
    marginLeft: 4,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  registerLink: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});