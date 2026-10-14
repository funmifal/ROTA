import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, View, Text, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { useAppStore } from './src/state/useAppStore';
import { Colors, Typography, Spacing, Effects } from './src/theme/tokens';
import { SplashScreen } from './src/features/auth/SplashScreen';
import { OnboardingScreen } from './src/features/auth/OnboardingScreen';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { DashboardScreen } from './src/features/business/DashboardScreen';
import { InviteAcceptanceModal } from './src/features/team/InviteAcceptanceModal';
import { User, Business } from './src/services/api';

type AppState = 'splash' | 'onboarding' | 'auth' | 'dashboard';

function GlobalToast() {
  const toastMessage = useAppStore((s) => s.toastMessage);
  const clearToast = useAppStore((s) => s.clearToast);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        clearToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!toastMessage) return null;

  const bg =
    toastMessage.type === 'error'
      ? Colors.error
      : toastMessage.type === 'success'
      ? Colors.success
      : Colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={clearToast}
      style={[styles.toastContainer, { backgroundColor: bg }]}
    >
      <Text style={styles.toastText}>{toastMessage.text}</Text>
    </TouchableOpacity>
  );
}

function MainAppContent() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const showToast = useAppStore((s) => s.showToast);

  // Deep linking handler: listens to incoming links (rota://invite?token=XYZ or https://rota.app/invite/XYZ)
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        // Check for invitation deep links
        if (parsed.path?.includes('invite') || parsed.hostname === 'invite') {
          const token =
            (parsed.queryParams?.token as string) ||
            parsed.path?.split('invite/')[1]?.split('?')[0];
          if (token) {
            setInviteToken(token);
          }
        }

        // Check for payment return deep links (rota://billing)
        if (parsed.path?.includes('billing') || parsed.hostname === 'billing') {
          const status = parsed.queryParams?.status as string;
          const plan = (parsed.queryParams?.plan as string) || 'Team';
          if (status === 'success') {
            showToast(`🎉 Payment Successful! Your ${plan} Plan is now activated.`, 'success');
          } else {
            showToast('Payment processing completed.', 'info');
          }
        }
      } catch (err) {
        console.warn('Failed to parse incoming deep link URL:', err);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  const handleSessionChecked = (user: User | null) => {
    if (user) {
      setCurrentUser(user);
      setAppState('dashboard');
    } else {
      setCurrentUser(null);
      setAppState('onboarding');
    }
  };

  const handleStartCreateAccount = () => {
    setAuthTab('signup');
    setAppState('auth');
  };

  const handleGoToLogin = () => {
    setAuthTab('login');
    setAppState('auth');
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setAppState('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthTab('login');
    setAppState('auth');
  };

  const handleJoinedViaInvite = (user: User, business: Business) => {
    setCurrentUser(user);
    setAppState('dashboard');
    showToast(`Welcome! You have joined ${business.name}.`, 'success');
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
      {appState === 'onboarding' && (
        <OnboardingScreen
          onStartCreateAccount={handleStartCreateAccount}
          onGoToLogin={handleGoToLogin}
        />
      )}
      {appState === 'auth' && (
        <AuthScreen
          initialTab={authTab}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
      {appState === 'dashboard' && currentUser && (
        <DashboardScreen user={currentUser} onLogout={handleLogout} />
      )}

      {/* Deep Link Invitation Flow Modal */}
      <InviteAcceptanceModal
        token={inviteToken}
        currentUser={currentUser}
        onClose={() => setInviteToken(null)}
        onJoined={handleJoinedViaInvite}
      />

      <GlobalToast />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainAppContent />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    zIndex: 9999,
    ...Effects.mediumShadow,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
});
