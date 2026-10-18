import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { DateProvider } from './src/context/DateContext';
import { AlertProvider } from './src/context/AlertContext';
import { GlobalModals } from './src/components/common/Modals';
import { MainLayout } from './src/components/navigation/MainLayout';
import { getDatabase } from './src/database/db';

function RootApp() {
  const { isDark, theme } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    async function initDb() {
      try {
        await getDatabase();
        setDbReady(true);
      } catch (err) {
        console.error('Database initialization failed', err);
        setDbError(err.message || 'Failed to initialize offline database.');
      }
    }
    initDb();
  }, []);

  if (dbError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorTitle, { color: theme.danger }]}>Database Initialization Error</Text>
        <Text style={[styles.errorDesc, { color: theme.textSecondary }]}>{dbError}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Starting Sage Logistics Offline System...
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MainLayout />
      <GlobalModals />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DateProvider>
          <AlertProvider>
            <RootApp />
          </AlertProvider>
        </DateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 14,
    textAlign: 'center',
  },
});
