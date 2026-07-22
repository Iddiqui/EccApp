import React from 'react';
import { NavigationContainer, DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import messaging from '@react-native-firebase/messaging';

function MainApp() {
  const { theme, isDarkMode } = useTheme();

  // Navigation Container ki background theme match karna
  const navigationTheme = {
    ...(isDarkMode ? NavDarkTheme : NavLightTheme),
    colors: {
      ...(isDarkMode ? NavDarkTheme.colors : NavLightTheme.colors),
      background: theme.colors.bgLight,
      card: theme.colors.bgCard,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

export async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const fcmToken = await messaging().getToken();
    console.log('FCM Token generated:', fcmToken);
    
    // Send this fcmToken to your Backend Database for sending pushes!
    // await fetch('https://your-api.com/api/save-token', { method: 'POST', body: JSON.stringify({ fcmToken }) });
  }
}