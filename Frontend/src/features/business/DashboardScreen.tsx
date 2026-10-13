import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User, DashboardSummary } from '../../services/api';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getDashboardSummary();
        if (isMounted) {
          setSummary(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load dashboard overview';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      setLoggingOut(false);
      onLogout();
    }
  };

  return (
    <View style={styles.container}>
      {/* App Bar / Header */}
      <View style={styles.appBar}>
        <View>
          <Text style={styles.appBarTitle}>Rota</Text>
          <Text style={styles.appBarSubtitle}>Shift Management</Text>
        </View>
        <Button
          title="Log Out"
          variant="tonal"
          onPress={handleLogout}
          loading={loggingOut}
          style={styles.logoutButton}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome, {user.name}</Text>
          <Text style={styles.emailText}>{user.email}</Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Active Member</Text>
            </View>
          </View>
        </View>

        {error ? (
          <FeedbackBanner type="error" message={error} />
        ) : null}

        {/* Dashboard Overview */}
        <Text style={styles.sectionTitle}>Overview</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : summary ? (
          <View style={styles.overviewGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {summary.overview.upcomingShiftsCount}
              </Text>
              <Text style={styles.statLabel}>Upcoming Shifts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {summary.overview.pendingSwapsCount}
              </Text>
              <Text style={styles.statLabel}>Pending Swaps</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.xLargeSpacing + 8,
    paddingBottom: Spacing.baseSpacing,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  appBarTitle: {
    fontSize: Typography.titleLarge.fontSize,
    lineHeight: Typography.titleLarge.lineHeight,
    color: Colors.primary,
    fontWeight: '700',
  },
  appBarSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.neutral,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.mediumSpacing,
    minHeight: 36,
  },
  content: {
    padding: Spacing.baseSpacing,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.largeSpacing,
    marginBottom: Spacing.largeSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  welcomeText: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  emailText: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.neutral,
    marginTop: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: Spacing.mediumSpacing,
  },
  badge: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.mediumSpacing,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: Typography.labelSmall.fontSize,
    lineHeight: Typography.labelSmall.lineHeight,
    fontWeight: '600',
    color: Colors.onPrimaryContainer,
  },
  sectionTitle: {
    fontSize: Typography.titleMedium.fontSize,
    lineHeight: Typography.titleMedium.lineHeight,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: Spacing.mediumSpacing,
  },
  loadingContainer: {
    padding: Spacing.largeSpacing,
    alignItems: 'center',
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: Spacing.mediumSpacing,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    alignItems: 'center',
    ...Effects.softShadow,
  },
  statNumber: {
    fontSize: Typography.headlineMedium.fontSize,
    lineHeight: Typography.headlineMedium.lineHeight,
    fontWeight: '700',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.neutral,
    marginTop: 4,
    textAlign: 'center',
  },
});
