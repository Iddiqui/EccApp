import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── LIGHT THEME ───
export const LIGHT_THEME = {
  isDarkMode: false,
  colors: {
    bgLight: '#F8FAFC',
    bgCard: '#FFFFFF',
    primary: '#2563EB',
    accentPurple: '#8B5CF6',
    accentLightPurple: '#EEF2FF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    iconBg: '#F1F5F9',
    successGreen: '#10B981',
    alertRed: '#EF4444',
  },
  radius: {
    md: 12,
    lg: 18,
    full: 9999,
  }
};

// ─── DARK THEME ───
export const DARK_THEME = {
  isDarkMode: true,
  colors: {
    bgLight: '#0F172A',
    bgCard: '#1E293B',
    primary: '#3B82F6',
    accentPurple: '#A78BFA',
    accentLightPurple: '#312E81',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    iconBg: '#334155',
    successGreen: '#10B981',
    alertRed: '#EF4444',
  },
  radius: {
    md: 12,
    lg: 18,
    full: 9999,
  }
};

type ThemeContextType = {
  theme: typeof LIGHT_THEME;
  isDarkMode: boolean;
  toggleDarkMode: (value?: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT_THEME,
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem('user_dark_mode').then((val) => {
      if (val !== null) {
        setIsDarkMode(JSON.parse(val));
      }
    });
  }, []);

  const toggleDarkMode = (value?: boolean) => {
    const newValue = value !== undefined ? value : !isDarkMode;
    setIsDarkMode(newValue);
    AsyncStorage.setItem('user_dark_mode', JSON.stringify(newValue));
  };

  const currentTheme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: LIGHT_THEME, isDarkMode: false, toggleDarkMode: () => {} };
  }
  return context;
}