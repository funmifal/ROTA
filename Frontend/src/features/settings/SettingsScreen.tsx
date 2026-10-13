import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { useUserSettings, useUpdateUserSettings } from './useSettingsQuery';
import { useAppStore } from '../../state/useAppStore';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { data: settings, isLoading, isError, error, refetch, isFetching } = useUserSettings();
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateUserSettings();

  const shouldSimulateSettingsFailure = useAppStore((s) => s.shouldSimulateSettingsFailure);
  const setShouldSimulateSettingsFailure = useAppStore((s) => s.setShouldSimulateSettingsFailure);

  const handleToggle = (key: string, value: boolean) => {
    updateSettings({ [key]: value });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>App & Notification Settings</Text>
          <Text style={styles.appBarSubtitle}>Synced Across All Devices</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => refetch()}
          disabled={isFetching}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={isFetching ? Colors.neutral : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Testing Banner for Rollback */}
        <View style={styles.testBannerCard}>
          <View style={styles.testBannerHeader}>
            <Ionicons name="flask-outline" size={18} color={Colors.primary} />
            <Text style={styles.testBannerTitle}>Settings Rollback Tester</Text>
          </View>
          <Text style={styles.testBannerSubtitle}>
            Toggle below to simulate a network/server failure when toggling any setting.
            Watch the switch immediately flip (optimistic update) and then cleanly snap back
            to its original state with an error banner upon server failure.
          </Text>
          <View style={styles.testToggleRow}>
            <Text style={styles.testToggleLabel}>Simulate Server Sync Failure</Text>
            <Switch
              value={shouldSimulateSettingsFailure}
              onValueChange={(val) => setShouldSimulateSettingsFailure(val)}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.errorContainer }}
              thumbColor={shouldSimulateSettingsFailure ? Colors.error : Colors.neutralContainer}
            />
          </View>
        </View>

        {isError && (
          <FeedbackBanner
            type="error"
            message={error?.message || 'Failed to load user settings.'}
          />
        )}

        {isLoading && !settings ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : (
          <View>
            {/* Notifications Category */}
            <Text style={styles.sectionHeader}>Notifications & Alerts</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Push Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Receive immediate push notifications on schedule publishes
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.notificationsEnabled ?? true}
                  onValueChange={(val) => handleToggle('notificationsEnabled', val)}
                  trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
                  thumbColor={settings?.notificationsEnabled ? Colors.primary : Colors.neutralContainer}
                />
              </View>

              <View style={styles.settingItemDivider} />

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="alarm-outline" size={20} color={Colors.primary} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Shift Reminders</Text>
                    <Text style={styles.settingDescription}>
                      Get reminder alerts 2 hours before scheduled shift starts
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.shiftReminders ?? true}
                  onValueChange={(val) => handleToggle('shiftReminders', val)}
                  trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
                  thumbColor={settings?.shiftReminders ? Colors.primary : Colors.neutralContainer}
                />
              </View>

              <View style={styles.settingItemDivider} />

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Email Alerts</Text>
                    <Text style={styles.settingDescription}>
                      Receive email notifications for invitations and swap approvals
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.emailAlerts ?? true}
                  onValueChange={(val) => handleToggle('emailAlerts', val)}
                  trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
                  thumbColor={settings?.emailAlerts ? Colors.primary : Colors.neutralContainer}
                />
              </View>
            </View>

            {/* Preferences Category */}
            <Text style={[styles.sectionHeader, { marginTop: Spacing.largeSpacing }]}>
              Display & Workflow Preferences
            </Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="time-outline" size={20} color={Colors.primary} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>24-Hour Time Format</Text>
                    <Text style={styles.settingDescription}>
                      Display shift times in 24:00 military format instead of 12 AM/PM
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.timeFormat24h ?? false}
                  onValueChange={(val) => handleToggle('timeFormat24h', val)}
                  trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
                  thumbColor={settings?.timeFormat24h ? Colors.primary : Colors.neutralContainer}
                />
              </View>

              <View style={styles.settingItemDivider} />

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-horizontal-outline" size={20} color={Colors.primary} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Auto-Accept Incoming Swaps</Text>
                    <Text style={styles.settingDescription}>
                      Automatically accept peer shift swap requests without manual prompt
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.autoAcceptSwaps ?? false}
                  onValueChange={(val) => handleToggle('autoAcceptSwaps', val)}
                  trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
                  thumbColor={settings?.autoAcceptSwaps ? Colors.primary : Colors.neutralContainer}
                />
              </View>
            </View>
          </View>
        )}
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
    alignItems: 'center',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.largeSpacing + 4,
    paddingBottom: Spacing.baseSpacing,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  appBarTitle: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  appBarSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  refreshButton: {
    padding: 6,
  },
  content: {
    padding: Spacing.baseSpacing,
    paddingBottom: 40,
  },
  testBannerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  testBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testBannerTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  testBannerSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 4,
    marginBottom: Spacing.smallSpacing,
  },
  testToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  testToggleLabel: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  sectionHeader: {
    fontSize: Typography.labelLarge.fontSize,
    fontWeight: '700',
    color: Colors.neutral,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.smallSpacing,
    marginLeft: 4,
  },
  settingsGroup: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.baseSpacing,
  },
  settingItemDivider: {
    height: 1,
    backgroundColor: Colors.surfaceContainer,
    marginLeft: 48,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.mediumSpacing,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  settingDescription: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 2,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: Typography.bodyMedium.fontSize,
    color: Colors.neutral,
  },
});
