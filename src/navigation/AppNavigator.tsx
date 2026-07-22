import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens Imports
import AuthOnboardingFlow from '../screens/OnboardingScreen'; 
import LoginScreen from '../features/auth/screens/LoginScreen';
import TabNavigator from './TabNavigator'; 
import SettingsScreen from '../features/home/screens/SettingsScreen';
import NotificationScreen from '../features/home/screens/NotificationScreen';

// 1. VoiceRoomScreen import karein
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen';

const Stack = createNativeStackNavigator();

interface AppNavigatorProps {
  theme?: any;
}

export default function AppNavigator({ theme }: AppNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={AuthOnboardingFlow} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Dashboard" component={TabNavigator} />
      
      {/* Settings Screen */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      
      {/* Notification Screen */}
      <Stack.Screen 
        name="Notifications" 
        component={NotificationScreen} 
        options={{ animation: 'slide_from_right' }} 
      />

      {/* 2. VoiceRoomScreen yahan register karein */}
      <Stack.Screen 
        name="VoiceRoomScreen" 
        component={VoiceRoomScreen} 
        options={{ animation: 'slide_from_bottom' }} 
      />
    </Stack.Navigator>
  );
}