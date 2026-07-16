import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Sahi import structure
import AuthOnboardingFlow from '../screens/OnboardingScreen'; // Filename specify karein
import LoginScreen from '../features/auth/screens/LoginScreen';
import TabNavigator from './TabNavigator'; // Kyunki TabNavigator bhi isi folder mein hai
// SettingsScreen ko import kiya
import SettingsScreen from '../features/home/screens/SettingsScreen';
// NotificationScreen ko yahan import kiya
import NotificationScreen from '../features/home/screens/NotificationScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={AuthOnboardingFlow} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Dashboard" component={TabNavigator} />
      
      {/* Settings Screen ko yahan register kar diya */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      
      {/* ─── NOTIFICATION SCREEN REGISTER KIYA ─── */}
      <Stack.Screen 
        name="Notifications" 
        component={NotificationScreen} 
        options={{ animation: 'slide_from_right' }} // Smooth navigation slide affect ke liye
      />
    </Stack.Navigator>
  );
}