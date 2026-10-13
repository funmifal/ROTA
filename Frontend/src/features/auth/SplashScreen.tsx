import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import { storage } from '../../services/storage';
import { api, User } from '../../services/api';

interface SplashScreenProps {
  onSessionChecked: (authenticatedUser: User | null) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onSessionChecked }) => {
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const token = await storage.getToken();
        if (!token) {
          if (isMounted) onSessionChecked(null);
          return;
        }

        // Verify token with backend
        const res = await api.getMe();
        if (isMounted) {
          onSessionChecked(res.user);
        }
      } catch (err) {
        // Token invalid or network issue, fallback to unauthenticated
        await storage.deleteToken();
        if (isMounted) onSessionChecked(null);
      }
    }

    // Small delay to prevent visual flicker
    const timer = setTimeout(checkSession, 800);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [onSessionChecked]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>R</Text>
        </View>
        <Text style={styles.title}>Rota</Text>
        <Text style={styles.subtitle}>Shift scheduling for small business</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.onPrimary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xLargeSpacing * 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.baseSpacing,
  },
  logoBadgeText: {
    fontSize: Typography.displaySmall.fontSize,
    lineHeight: Typography.displaySmall.lineHeight,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  title: {
    fontSize: Typography.displayMedium.fontSize,
    lineHeight: Typography.displayMedium.lineHeight,
    color: Colors.onPrimary,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.primaryContainer,
    marginTop: Spacing.smallSpacing,
  },
  footer: {
    alignItems: 'center',
  },
});
