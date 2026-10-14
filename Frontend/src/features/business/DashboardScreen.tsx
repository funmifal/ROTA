import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User, Business, DashboardSummary } from '../../services/api';
import { CreateBusinessModal } from './CreateBusinessModal';
import { UpgradePlanModal } from '../billing/UpgradePlanModal';
import { TeamScreen } from '../team/TeamScreen';
import { ActivityFeedScreen } from '../activity/ActivityFeedScreen';
import { ShiftsScreen } from '../shifts/ShiftsScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { useAppStore } from '../../state/useAppStore';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTeamScreen, setShowTeamScreen] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showShiftsScreen, setShowShiftsScreen] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [bizRes, summaryRes] = await Promise.all([
        api.getBusinesses(),
        api.getDashboardSummary().catch(() => null),
      ]);

      setBusinesses(bizRes.businesses);
      if (bizRes.businesses.length > 0) {
        setActiveBusiness(bizRes.businesses[0]);
      }
      setSummary(summaryRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
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

  const handleBusinessCreated = (newBiz: Business) => {
    setCreateModalVisible(false);
    setBusinesses((prev) => [newBiz, ...prev]);
    setActiveBusiness(newBiz);
  };

  if (showShiftsScreen && activeBusiness) {
    return (
      <ShiftsScreen
        business={activeBusiness}
        onBack={() => {
          setShowShiftsScreen(false);
          fetchInitialData();
        }}
      />
    );
  }

  if (showSettingsScreen) {
    return (
      <SettingsScreen
        onBack={() => setShowSettingsScreen(false)}
        onLogoutAll={handleLogout}
      />
    );
  }

  if (showTeamScreen && activeBusiness) {
    return (
      <TeamScreen
        business={activeBusiness}
        currentUserRole={activeBusiness.currentUserRole || 'STAFF'}
        onBack={() => {
          setShowTeamScreen(false);
          fetchInitialData();
        }}
      />
    );
  }

  if (showActivityFeed && activeBusiness) {
    return (
      <ActivityFeedScreen
        business={activeBusiness}
        onBack={() => setShowActivityFeed(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* App Bar / Header */}
      <View style={styles.appBar}>
        <View>
          <Text style={styles.appBarTitle}>Rota</Text>
          <Text style={styles.appBarSubtitle}>Workforce & Shifts</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.settingsIconButton}
            onPress={() => setShowSettingsScreen(true)}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <Button
            title="Log Out"
            variant="tonal"
            onPress={handleLogout}
            loading={loggingOut}
            style={styles.logoutButton}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome, {user.name}</Text>
          <Text style={styles.emailText}>{user.email}</Text>
        </View>

        {error ? <FeedbackBanner type="error" message={error} /> : null}

        {/* Business Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Business Organization</Text>
          <TouchableOpacity
            style={styles.createBizHeaderButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.createBizHeaderText}>New Business</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : businesses.length === 0 ? (
          <View style={styles.emptyBizCard}>
            <Ionicons name="business-outline" size={44} color={Colors.neutral} />
            <Text style={styles.emptyBizTitle}>No Business Created Yet</Text>
            <Text style={styles.emptyBizSubtitle}>
              Create your business to start building schedules, setting shifts, and inviting your team.
            </Text>
            <Button
              title="Create Business"
              onPress={() => setCreateModalVisible(true)}
              variant="primary"
              style={{ marginTop: Spacing.mediumSpacing }}
            />
          </View>
        ) : (
          <View>
            {activeBusiness && (
              <View style={styles.businessActiveCard}>
                <View style={styles.bizHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bizName}>{activeBusiness.name}</Text>
                    <Text style={styles.bizDetails}>
                      {activeBusiness.industry || 'Business'} • {activeBusiness.timezone}
                    </Text>
                  </View>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {activeBusiness.currentUserRole || 'MEMBER'}
                    </Text>
                  </View>
                </View>

                <View style={styles.bizStatsRow}>
                  <View style={styles.bizStatItem}>
                    <Ionicons name="people-outline" size={16} color={Colors.neutral} />
                    <Text style={styles.bizStatText}>
                      {activeBusiness.memberCount ?? 1} Team Member{activeBusiness.memberCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                {/* Upgrade Plan Banner */}
                <TouchableOpacity
                  style={styles.upgradePlanBanner}
                  onPress={() => setShowUpgradeModal(true)}
                  activeOpacity={0.85}
                  accessibilityLabel="Upgrade Plan Button"
                >
                  <View style={styles.upgradeBannerLeft}>
                    <View style={styles.upgradeIconWrap}>
                      <Ionicons name="sparkles" size={18} color={Colors.tertiary} />
                    </View>
                    <View style={styles.upgradeBannerTextWrap}>
                      <Text style={styles.upgradeBannerTitle}>Free Plan (5 Seats)</Text>
                      <Text style={styles.upgradeBannerSubtitle}>
                        Upgrade to unlock 15–40+ seats, automated swaps & Flutterwave billing
                      </Text>
                    </View>
                  </View>
                  <View style={styles.upgradeBannerButton}>
                    <Text style={styles.upgradeBannerButtonText}>Upgrade</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.onPrimary} />
                  </View>
                </TouchableOpacity>

                {/* Primary Action: Upcoming Shifts */}
                <Button
                  title="Upcoming Shifts (Offline & Swaps)"
                  onPress={() => setShowShiftsScreen(true)}
                  variant="primary"
                  style={{ marginTop: Spacing.smallSpacing, marginBottom: Spacing.smallSpacing }}
                />

                <View style={styles.bizActionRow}>
                  <Button
                    title="Team & Invites"
                    onPress={() => setShowTeamScreen(true)}
                    variant="tonal"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Activity Feed"
                    onPress={() => setShowActivityFeed(true)}
                    variant="tonal"
                    style={{ flex: 1, marginLeft: Spacing.smallSpacing }}
                  />
                </View>
              </View>
            )}

            {businesses.length > 1 && (
              <View style={styles.bizSwitcher}>
                <Text style={styles.switcherLabel}>Switch Business:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {businesses.map((biz) => (
                    <TouchableOpacity
                      key={biz.id}
                      style={[
                        styles.switcherChip,
                        biz.id === activeBusiness?.id && styles.activeSwitcherChip,
                      ]}
                      onPress={() => setActiveBusiness(biz)}
                    >
                      <Text
                        style={[
                          styles.switcherChipText,
                          biz.id === activeBusiness?.id && styles.activeSwitcherChipText,
                        ]}
                      >
                        {biz.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Dashboard Overview */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.largeSpacing }]}>
          Schedule Overview
        </Text>

        <View style={styles.overviewGrid}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => {
              if (activeBusiness) setShowShiftsScreen(true);
            }}
          >
            <Text style={styles.statNumber}>
              {summary?.overview?.upcomingShiftsCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Upcoming Shifts</Text>
            <Text style={styles.tapToViewText}>Tap to View & Swaps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => {
              if (activeBusiness) setShowShiftsScreen(true);
            }}
          >
            <Text style={styles.statNumber}>
              {summary?.overview?.pendingSwapsCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Pending Swaps</Text>
            <Text style={styles.tapToViewText}>Tap to View</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CreateBusinessModal
        visible={createModalVisible}
        onSuccess={handleBusinessCreated}
        onClose={() => setCreateModalVisible(false)}
      />

      {activeBusiness && (
        <UpgradePlanModal
          visible={showUpgradeModal}
          businessId={activeBusiness.id}
          businessName={activeBusiness.name}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
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
    paddingTop: Spacing.largeSpacing + 4,
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
    marginBottom: Spacing.baseSpacing,
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
    color: Colors.neutral,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.smallSpacing,
    marginBottom: Spacing.mediumSpacing,
  },
  sectionTitle: {
    fontSize: Typography.titleMedium.fontSize,
    lineHeight: Typography.titleMedium.lineHeight,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  createBizHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createBizHeaderText: {
    fontSize: Typography.labelMedium.fontSize,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyBizCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.largeSpacing,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  emptyBizTitle: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: Spacing.smallSpacing,
    marginBottom: 4,
  },
  emptyBizSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    textAlign: 'center',
    maxWidth: 280,
  },
  businessActiveCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.largeSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  bizHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.smallSpacing,
  },
  bizName: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  bizDetails: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
  bizStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: Spacing.smallSpacing,
  },
  bizStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bizStatText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  bizActionRow: {
    flexDirection: 'row',
    marginTop: Spacing.baseSpacing,
  },
  bizSwitcher: {
    marginTop: Spacing.mediumSpacing,
  },
  switcherLabel: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.neutral,
    fontWeight: '600',
  },
  switcherChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  activeSwitcherChip: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  switcherChipText: {
    fontSize: 12,
    color: Colors.neutral,
  },
  activeSwitcherChipText: {
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: Spacing.largeSpacing,
    alignItems: 'center',
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: Spacing.mediumSpacing,
    marginTop: Spacing.smallSpacing,
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
  tapToViewText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  settingsIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceContainerLow,
  },
  upgradePlanBanner: {
    backgroundColor: Colors.tertiaryContainer,
    borderRadius: 12,
    padding: Spacing.mediumSpacing,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.smallSpacing,
    marginBottom: Spacing.smallSpacing,
    borderWidth: 1,
    borderColor: '#ffc885',
  },
  upgradeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: Spacing.smallSpacing,
  },
  upgradeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.smallSpacing,
  },
  upgradeBannerTextWrap: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: Typography.labelLarge.fontSize,
    lineHeight: Typography.labelLarge.lineHeight,
    fontWeight: '700',
    color: Colors.onTertiaryContainer,
  },
  upgradeBannerSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.onTertiaryContainer,
    marginTop: 2,
    opacity: 0.85,
  },
  upgradeBannerButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 2,
  },
  upgradeBannerButtonText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: Typography.labelMedium.fontSize,
  },
});
