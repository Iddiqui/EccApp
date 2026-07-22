import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  Alert, 
  StyleSheet, 
  ActivityIndicator,
  StatusBar
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
  const colors = theme.colors;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);

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
        // Safe to ignore if no user logged in previously
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
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.bgLight} />
      
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Welcome Back</Text>

      <Text style={[styles.label, { color: colors.textPrimary }]}>Email Address</Text>
      <TextInput 
        placeholder="Enter your email" 
        placeholderTextColor={colors.textSecondary}
        onChangeText={setEmail} 
        value={email}
        style={[
          styles.input, 
          { 
            backgroundColor: colors.bgCard, 
            borderColor: colors.border, 
            color: colors.textPrimary 
          }
        ]} 
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
      <TextInput 
        placeholder="Enter your password" 
        placeholderTextColor={colors.textSecondary}
        onChangeText={setPassword} 
        value={password}
        style={[
          styles.input, 
          { 
            backgroundColor: colors.bgCard, 
            borderColor: colors.border, 
            color: colors.textPrimary 
          }
        ]} 
        secureTextEntry={true} 
        autoCapitalize="none"
        editable={!loading}
      />

      <TouchableOpacity 
        onPress={handleLogin} 
        style={[styles.button, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>LOGIN</Text>
        )}
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <TouchableOpacity 
        onPress={handleGoogleLogin} 
        style={[
          styles.googleButton, 
          { 
            backgroundColor: colors.bgCard, 
            borderColor: colors.border 
          }, 
          loading && { opacity: 0.6 }
        ]}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
          Continue with Google
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24 
  },
  heading: { 
    fontSize: 28, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 40,
    letterSpacing: -0.5
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 8 
  },
  input: { 
    height: 52, 
    borderWidth: 1, 
    borderRadius: 14, 
    marginBottom: 20, 
    paddingHorizontal: 16, 
    fontSize: 15 
  },
  button: { 
    padding: 16, 
    borderRadius: 14, 
    marginTop: 10, 
    elevation: 2, 
    height: 54, 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: { 
    color: '#FFFFFF', 
    textAlign: 'center', 
    fontWeight: '700', 
    fontSize: 16, 
    letterSpacing: 0.5 
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 25 
  },
  dividerLine: { 
    flex: 1, 
    height: 1 
  },
  dividerText: { 
    paddingHorizontal: 16, 
    fontSize: 13, 
    fontWeight: '700' 
  },
  googleButton: { 
    borderWidth: 1, 
    padding: 16, 
    borderRadius: 14, 
    elevation: 1, 
    height: 54, 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  googleButtonText: { 
    textAlign: 'center', 
    fontWeight: '700', 
    fontSize: 15 
  }
});