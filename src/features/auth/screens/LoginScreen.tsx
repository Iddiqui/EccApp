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
  Platform,
  Image,
  KeyboardAvoidingView
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
  const themeHook = useTheme() as any;
  const isDarkMode = themeHook?.isDarkMode || false;

  // Screen States
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [showForm, setShowForm] = useState(false);

  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);

  // Back Button Navigation
  const handleBackPress = () => {
    if (showForm) {
      setShowForm(false);
    } else if (mode === 'login') {
      setMode('signup');
    } else {
      navigation.navigate('Onboarding');
    }
  };

  // Action Button Handler
  const handleEmailAction = () => {
    if (mode === 'signup') {
      navigation.navigate('Register');
    } else {
      setShowForm(true);
    }
  };

  // Email Login Handler (No Photo Stored In Firestore)
  const handleEmailLoginSubmit = async () => {
    if (email.trim().length === 0 || password.length === 0) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email.trim(), password);
      const user = userCredential.user;

      if (user) {
        const userDocRef = firestore().collection('users').doc(user.uid);
        const userSnapshot = await userDocRef.get();

        if (!userSnapshot.exists) {
          await userDocRef.set({
            uid: user.uid,
            fullName: user.displayName || user.email?.split('@')[0] || 'Learner',
            email: user.email,
            role: 'user',
            streak: 0,
            speakingScore: 0,
            fluency: 0,
            isOnline: true,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
        } else {
          await userDocRef.set({
            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }

      setLoading(false);
      navigation.replace('Dashboard');
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Authentication Failed", "Invalid email or password.");
    }
  };

  // Google Sign-In (Direct Auth Photo Session, ZERO Firestore Photo Storage)
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch (e) {}

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
        const userDocRef = firestore().collection('users').doc(user.uid);
        const userSnapshot = await userDocRef.get();

        // 🌟 Pure Clean User Metadata Creation (NO photoURL in Firestore)
        if (!userSnapshot.exists) {
          await userDocRef.set({
            uid: user.uid,
            fullName: user.displayName || 'Learner',
            email: user.email,
            role: 'user',
            streak: 0,
            speakingScore: 0,
            fluency: 0,
            isOnline: true,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
        } else {
          await userDocRef.set({
            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
      
      setLoading(false);
      navigation.replace('Dashboard');
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Google Auth Error", error?.message || "Google sign in failed");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor="#F1F5F9" />
      
      {/* 🌟 UNIQUE FLOATING SQUIRCLE BACKGROUND MESH */}
      <View style={styles.squircleTopRight} />
      <View style={styles.squircleMidLeft} />
      <View style={styles.squircleBottomRight} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* LOCAL ASSET IMAGE */}
          <View style={styles.heroWrapper}>
            <Image 
              source={require('../../../assets/login_img.png')} 
              style={[styles.heroImage, showForm && styles.heroImageCompact]} 
              resizeMode="contain" 
            />
          </View>

          {/* Dynamic Title */}
          <Text style={styles.heading}>
            {mode === 'signup' ? (
              <>Create Your <Text style={{ color: '#5356FF' }}>Account</Text></>
            ) : (
              <>Welcome{'\n'}<Text style={{ color: '#0F172A' }}>Back</Text></>
            )}
          </Text>
          
          {!showForm && (
            <Text style={styles.subHeading}>
              {mode === 'signup' 
                ? 'Join ECC and start your journey towards fluent and confident English.'
                : 'Log in to continue your journey towards fluent and confident English.'}
            </Text>
          )}

          {/* VIEW 1: LANDING BUTTON OPTIONS */}
          {!showForm ? (
            <View style={styles.actionWrapper}>
              
              {/* Colorful Google Button */}
              <TouchableOpacity 
                onPress={handleGoogleLogin} 
                style={[styles.socialButton, loading && { opacity: 0.6 }]}
                disabled={loading}
                activeOpacity={0.85}
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
                activeOpacity={0.85}
              >
                <Text style={styles.socialButtonText}>Continue with </Text>
                <Text style={styles.phoneIcon}>📱 Phone</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Glossy Action Button */}
              <TouchableOpacity 
                style={styles.glossyPurpleBtn}
                onPress={handleEmailAction}
                activeOpacity={0.85}
              >
                <View style={styles.btnInnerCircle} />
                <Text style={styles.glossyBtnText}>
                  {mode === 'signup' ? 'Sign Up with Email' : 'Log In with Email'}
                </Text>
                <Text style={styles.arrowIcon}>→</Text>
              </TouchableOpacity>

              {/* Mode Switcher */}
              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>
                  {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                </Text>
                <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
                  <Text style={styles.registerLink}>
                    {mode === 'signup' ? 'Log In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Security Shield Tag */}
              <View style={styles.securityTag}>
                <Text style={{ fontSize: 13 }}>🛡️</Text>
                <Text style={styles.securityTagText}>Your data is safe and secure with us.</Text>
              </View>
            </View>

          ) : (

            /* VIEW 2: PREMIUM GLOSSY FORM VIEW */
            <View style={styles.glossyCardWrapper}>
              
              {/* Email Address Input */}
              <View style={styles.glossyInputContainer}>
                <TextInput 
                  placeholder="Email Address" 
                  placeholderTextColor="#A0AEC0"
                  onChangeText={setEmail} 
                  value={email}
                  style={styles.glossyInput} 
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.glossyInputContainer}>
                <TextInput 
                  placeholder="Password" 
                  placeholderTextColor="#A0AEC0"
                  onChangeText={setPassword} 
                  value={password}
                  style={styles.glossyInput} 
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

              {/* Glossy Primary Login Button */}
              <TouchableOpacity 
                onPress={handleEmailLoginSubmit} 
                style={[styles.glossySubmitBtn, loading && { opacity: 0.7 }]}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.glossySubmitBtnText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* Footer Redirect */}
              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => {
                  setShowForm(false);
                  setMode('signup');
                }}>
                  <Text style={styles.registerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },

  /* 🌟 ROTATED SQUIRCLE MESH STYLING */
  squircleTopRight: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 230,
    height: 230,
    borderRadius: 56,
    backgroundColor: '#C7D2FE',
    opacity: 0.65,
    transform: [{ rotate: '28deg' }],
  },
  squircleMidLeft: {
    position: 'absolute',
    top: 180,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 52,
    backgroundColor: '#E0E7FF',
    opacity: 0.8,
    transform: [{ rotate: '-18deg' }],
  },
  squircleBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 48,
    backgroundColor: '#DDD6FE',
    opacity: 0.6,
    transform: [{ rotate: '42deg' }],
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  backArrow: {
    fontSize: 22,
    color: '#1E293B',
    fontWeight: '800',
    transform: [{ translateY: -1 }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 24,
    justifyContent: 'center',
    zIndex: 5,
  },
  heroWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 10,
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  heroImageCompact: {
    height: 120,
  },
  heading: { 
    fontSize: 28, 
    fontWeight: '900', 
    textAlign: 'center', 
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 34,
  },
  subHeading: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  actionWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  socialButton: { 
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    height: 54, 
    width: '100%',
    borderRadius: 27, 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  socialButtonText: { 
    fontSize: 15, 
    fontWeight: '700',
    color: '#334155',
  },
  googleBrandText: {
    fontSize: 16,
    fontWeight: '800',
  },
  phoneIcon: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%',
    marginVertical: 10 
  },
  dividerLine: { 
    flex: 1, 
    height: 1,
    backgroundColor: '#CBD5E1'
  },
  dividerText: { 
    paddingHorizontal: 12, 
    fontSize: 12, 
    fontWeight: '800',
    color: '#94A3B8'
  },
  glossyPurpleBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5356FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 18,
  },
  btnInnerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  glossyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  arrowIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  securityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  securityTagText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  /* GLOSSY FORM STYLING */
  glossyCardWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginTop: 10,
  },
  glossyInputContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 25,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  glossyInput: { 
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  forgotPassContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPassText: {
    color: '#5356FF',
    fontSize: 13,
    fontWeight: '700',
  },
  glossySubmitBtn: { 
    backgroundColor: '#5356FF', 
    height: 54, 
    borderRadius: 27, 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5356FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  glossySubmitBtnText: { 
    color: '#FFFFFF', 
    fontWeight: '800', 
    fontSize: 17, 
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  registerLink: {
    color: '#5356FF',
    fontSize: 14,
    fontWeight: '800',
  },
});