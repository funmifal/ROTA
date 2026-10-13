import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { Colors } from './src/theme/tokens';
import { SplashScreen } from './src/features/auth/SplashScreen';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { DashboardScreen } from './src/features/business/DashboardScreen';
import { User } from './src/services/api';

type AppState = 'splash' | 'auth' | 'dashboard';

export default function App() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleSessionChecked = (user: User | null) => {
    if (user) {
      setCurrentUser(user);
      setAppState('dashboard');
    } else {
      setCurrentUser(null);
      setAppState('auth');
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setAppState('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAppState('auth');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={appState === 'splash' ? 'light-content' : 'dark-content'}
        backgroundColor={appState === 'splash' ? Colors.primary : Colors.surface}
      />
      {appState === 'splash' && (
        <SplashScreen onSessionChecked={handleSessionChecked} />
      )}
      {appState === 'auth' && (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      )}
      {appState === 'dashboard' && currentUser && (
        <DashboardScreen user={currentUser} onLogout={handleLogout} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
});
