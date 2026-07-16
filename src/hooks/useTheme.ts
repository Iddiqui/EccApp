import { useState } from 'react';

export const LIGHT_THEME = {
  colors: {
    bgLight: '#F8FAFC',
    bgCard: '#FFFFFF',
    primary: '#6366F1',
    accentPurple: '#8B5CF6',
    accentLightPurple: '#EEF2FF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    successGreen: '#10B981',
    alertRed: '#EF4444',
  },
  radius: {
    md: 12,
    lg: 18,
    full: 9999,
  }
};

// Yahan standard Named Export 'useTheme' define kiya hai jo App.tsx dhoond raha hai
export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState(LIGHT_THEME);

  // Future me agar dark theme handle karna ho to yahan toggle function add kar sakte hain
  return { 
    theme: currentTheme 
  };
}