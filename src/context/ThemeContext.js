import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../styles/theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      try {
        const stored = await AsyncStorage.getItem('@theme_mode');
        if (stored !== null) {
          setIsDark(stored === 'dark');
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    }
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const next = !isDark;
      setIsDark(next);
      await AsyncStorage.setItem('@theme_mode', next ? 'dark' : 'light');
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
