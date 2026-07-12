import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface NavigatorProps {
  theme: any;
}

export default function AppNavigator({ theme }: NavigatorProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Onboarding">
        {(props) => <OnboardingScreen {...props} theme={theme} />}
      </Stack.Screen>
      
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} theme={theme} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}