 import { useState } from 'react';

export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Is control state ko future settings se dynamic bind karenge

  const theme = {
    background: isDarkMode ? '#060613' : '#FFFFFF',
    textPrimary: isDarkMode ? '#FFFFFF' : '#121212',
    textSecondary: isDarkMode ? '#A0A0B5' : '#66667A',
    accent: '#6C5CE7',
    cardBg: isDarkMode ? '#111125' : '#F5F5FA',
    border: isDarkMode ? '#22223B' : '#EAEAEA',
  };

  return { theme, isDarkMode, setIsDarkMode };
};