import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// ─── LIVEKIT WEBRTC INITIALIZATION ───
import { registerGlobals } from '@livekit/react-native';
registerGlobals();

// ─── SCREENS IMPORTS ───
import AuthOnboardingFlow from '../screens/OnboardingScreen'; 
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import MobileLoginScreen from '../features/auth/screens/MobileLoginScreen';
import TabNavigator from './TabNavigator'; 
import SettingsScreen from '../features/home/screens/SettingsScreen';
import NotificationScreen from '../features/home/screens/NotificationScreen';
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen';
import ClassRoomScreen from '../features/home/screens/ClassRoomScreen';
import StudyRoomScreen from '../features/home/screens/StudyRoomScreen'; 

const Stack = createNativeStackNavigator();

interface AppNavigatorProps {
  theme?: any;
}

export default function AppNavigator({ theme }: AppNavigatorProps) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Auth State Listener setup
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((userState) => {
      setUser(userState);
      if (initializing) setInitializing(false);
    });

    return subscriber; 
  }, [initializing]);

  // Session status check hote waqt Loading Screen
  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // ─── AUTHENTICATED STACK (User Logged In Hai) ───
        <>
          <Stack.Screen name="Dashboard" component={TabNavigator} />
          
          {/* Settings Screen */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          
          {/* Notification Screen */}
          <Stack.Screen 
            name="Notifications" 
            component={NotificationScreen} 
            options={{ animation: 'slide_from_right' }} 
          />

          {/* Voice Room Screen */}
          <Stack.Screen 
            name="VoiceRoomScreen" 
            component={VoiceRoomScreen} 
            options={{ animation: 'slide_from_bottom' }} 
          />

          {/* 🎯 CLASS ROOM SCREEN (Video Room) */}
          <Stack.Screen 
            name="ClassRoomScreen" 
            component={ClassRoomScreen} 
            options={{ animation: 'slide_from_bottom' }} 
          />

          {/* 🎯 STUDY ROOM SCREEN (Audio Only Room) */}
          <Stack.Screen 
            name="StudyRoomScreen" 
            component={StudyRoomScreen} 
            options={{ animation: 'slide_from_bottom' }} 
          />
        </>
      ) : (
        // ─── UNAUTHENTICATED STACK (User Logged Out Hai) ───
        <>
          <Stack.Screen name="Onboarding" component={AuthOnboardingFlow} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} /> 
          <Stack.Screen name="MobileLogin" component={MobileLoginScreen} />     
          <Stack.Screen name="Register" component={RegisterScreen} /> 
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});