import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// ─── LIVEKIT WEBRTC INITIALIZATION ───
import { registerGlobals } from '@livekit/react-native';
registerGlobals();

// ─── NOTIFICATIONS ───
import { initNotifications } from '../services/notificationService';

// ─── SCREENS IMPORTS ───
import AuthOnboardingFlow from '../screens/OnboardingScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import MobileLoginScreen from '../features/auth/screens/MobileLoginScreen';
import CompleteProfileScreen from '../features/auth/screens/CompleteProfileScreen';
import { useProfileGate } from '../features/auth/useProfileGate';
import { isAuthRoutingPaused } from '../features/auth/authFlow';
import TabNavigator from './TabNavigator';
import SettingsScreen from '../features/home/screens/SettingsScreen';
import NotificationScreen from '../features/home/screens/NotificationScreen';
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen';
import ClassRoomScreen from '../features/home/screens/ClassRoomScreen';
import StudyRoomScreen from '../features/home/screens/StudyRoomScreen';
import { CallSessionProvider } from '../features/home/screens/CallSessionProvider';
import SubscriptionScreen from '../features/home/screens/SubscriptionScreen';
import VideoSessionScreen from '../features/sessions/VideoSessionScreen';
import OneToOneSessionsScreen from '../features/sessions/OneToOneSessionsScreen';
import TeacherProfileScreen from '../features/sessions/TeacherProfileScreen';
import SlotSelectionScreen from '../features/sessions/SlotSelectionScreen';
import UpcomingSessionsListScreen from '../features/sessions/UpcomingSessionsListScreen';
import AdminSlotCreationScreen from '../features/sessions/AdminSlotCreationScreen';
import DemoClassScreen from '../features/sessions/DemoClassScreen';
import ProgramFlowScreen from '../features/payments/ProgramFlowScreen';
import AdminPanelScreen from '../features/admin/AdminPanelScreen';
import BookSessionScreen from '../features/sessions/BookSessionScreen';
import TeacherDashboardScreen from '../features/sessions/TeacherDashboardScreen';
import TeacherSlotsScreen from '../features/sessions/TeacherSlotsScreen';
import TeacherProfileEditScreen from '../features/sessions/TeacherProfileEditScreen';
import AudioSessionsScreen from '../features/sessions/AudioSessionsScreen';
import TeacherAudioSessionsScreen from '../features/sessions/TeacherAudioSessionsScreen';
import RateSessionsScreen from '../features/sessions/RateSessionsScreen';

const Stack = createNativeStackNavigator();

interface AppNavigatorProps {
  theme?: any;
}

export default function AppNavigator({ theme }: AppNavigatorProps) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const navigation = useNavigation();

  // Auth state listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((userState) => {
      // Forgot-password-by-mobile signs in only for a moment; do not open the app for it
      if (isAuthRoutingPaused()) {
        if (initializing) setInitializing(false);
        return;
      }
      setUser(userState);
      if (initializing) setInitializing(false);
    });

    return subscriber;
  }, [initializing]);

  // New users must finish "Complete Your Profile" before they can use the app.
  // This also creates users/{uid} on the first sign-in.
  const gate = useProfileGate(user);

  // Shared room links: eccapp://room/<id> or https://.../room/<id>
  // The link opens the Rooms list with that room highlighted, so the user can tap it to join.
  const pendingRoomId = useRef<string | null>(null);
  const [roomLinkTick, setRoomLinkTick] = useState(0);

  useEffect(() => {
    const handle = (url?: string | null) => {
      const m = url ? url.match(/\/room\/([A-Za-z0-9_-]+)/) : null;
      if (m) {
        pendingRoomId.current = m[1];
        setRoomLinkTick((n) => n + 1);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || gate !== 'ready' || !pendingRoomId.current) return;
    const roomId = pendingRoomId.current;
    pendingRoomId.current = null;
    // Wait one moment so the signed-in stack is mounted
    const t = setTimeout(() => {
      (navigation as any).navigate('VoiceRoomScreen', { roomId });
    }, 400);
    return () => clearTimeout(t);
  }, [user, gate, roomLinkTick]);

  // Initialize push notifications once the user is logged in.
  // This hook must stay above the early return below to keep hook order stable.
  useEffect(() => {
    if (!user) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    initNotifications(navigation)
      .then((c) => {
        if (cancelled) c();
        else cleanup = c;
      })
      .catch((e) => console.warn('Notification init failed', e));

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Loading screen while the session status is being checked
  if (initializing || (user && gate === 'loading')) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // The whole navigator is wrapped in CallSessionProvider so the call overlay
  // (full call screen or minimized bubble) renders above the Stack.Navigator.
  // This keeps the bubble floating on every screen without disconnecting the call.
  //
  // freezeOnBlur is disabled to prevent a screen from staying blank/white after
  // a quick push and pop (for example when joining a Class Room).
  if (user && gate === 'needsProfile') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <CallSessionProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: false }}>
        {user ? (
          // ─── AUTHENTICATED STACK (user is logged in) ───
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

            {/* Class Room Screen (video room) */}
            <Stack.Screen
              name="ClassRoomScreen"
              component={ClassRoomScreen}
              options={{ animation: 'slide_from_bottom' }}
            />

            <Stack.Screen
              name="SubscriptionScreen"
              component={SubscriptionScreen}
              options={{ animation: 'slide_from_bottom' }}
            />

            <Stack.Screen
              name="VideoSessionScreen"
              component={VideoSessionScreen}
              options={{ animation: 'slide_from_bottom' }}
            />

            <Stack.Screen
              name="UpcomingSessionsListScreen"
              component={UpcomingSessionsListScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Study Room Screen (audio only room) */}
            <Stack.Screen
              name="StudyRoomScreen"
              component={StudyRoomScreen}
              options={{ animation: 'slide_from_bottom' }}
            />

            {/* 1-to-1 session booking flow */}
            <Stack.Screen
              name="OneToOneSessionsScreen"
              component={OneToOneSessionsScreen}
              options={{ animation: 'slide_from_right' }}
            />

            <Stack.Screen
              name="TeacherProfileScreen"
              component={TeacherProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />

            <Stack.Screen
              name="SlotSelectionScreen"
              component={SlotSelectionScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Demo (trial) class booking: date, time, tutor cards, payment */}
            <Stack.Screen
              name="DemoClassScreen"
              component={DemoClassScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Teacher side: dashboard, own slots, own profile */}
            <Stack.Screen
              name="TeacherDashboardScreen"
              component={TeacherDashboardScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="TeacherSlotsScreen"
              component={TeacherSlotsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="TeacherProfileEditScreen"
              component={TeacherProfileEditScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Audio group classes: student list + teacher management */}
            <Stack.Screen
              name="AudioSessionsScreen"
              component={AudioSessionsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="TeacherAudioSessionsScreen"
              component={TeacherAudioSessionsScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Rate finished sessions */}
            <Stack.Screen
              name="RateSessionsScreen"
              component={RateSessionsScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Book a session with a Video plan (no payment, uses one plan session) */}
            <Stack.Screen
              name="BookSessionScreen"
              component={BookSessionScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Video / Audio subscription purchase flow:
                mode -> intro -> teacher -> duration -> plan -> review -> payment -> success.
                Open with navigation.navigate('ProgramFlowScreen') or
                navigation.navigate('ProgramFlowScreen', { mode: 'video' | 'audio' }). */}
            <Stack.Screen
              name="ProgramFlowScreen"
              component={ProgramFlowScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Admin Panel: teacher access, plan prices, demo class price.
                The screen checks checkIsHost() and every action is re-checked on the server. */}
            <Stack.Screen
              name="AdminPanelScreen"
              component={AdminPanelScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Admin/teacher session slot creation.
                This route has no permission check of its own. Access is gated
                from the HomeScreen "Manage Session Slots" card via checkIsHost().
                Adding a safety check inside the screen itself is recommended. */}
            <Stack.Screen
              name="AdminSlotCreationScreen"
              component={AdminSlotCreationScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          // ─── UNAUTHENTICATED STACK (user is logged out) ───
          <>
            <Stack.Screen name="Onboarding" component={AuthOnboardingFlow} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="MobileLogin" component={MobileLoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </CallSessionProvider>
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