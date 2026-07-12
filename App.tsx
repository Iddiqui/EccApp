import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { useTheme } from './src/hooks/useTheme';

export default function App() {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <AppNavigator theme={theme} />
    </NavigationContainer>
  );
}