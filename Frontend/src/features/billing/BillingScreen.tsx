import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, Business } from '../../services/api';
import { UpgradePlanModal } from './UpgradePlanModal';
import { useAppStore } from '../../state/useAppStore';

interface BillingScreenProps {
  business: Business;
  onUpgrade?: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ business }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [prorationPreview, setProrationPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const showToast = useAppStore((s) => s.showToast);

  const fetchBillingInfo = async (showReconcileNotice = false) => {
    try {
      setError('');
      const verifyRes = await api.verifyLatestPayment(business.id).catch(() => null);
      if (verifyRes?.verified) {
        showToast(verifyRes.message, 'success');
      } else if (showReconcileNotice && verifyRes) {
        showToast(verifyRes.message, 'info');
      }

      const [subRes, ledgerRes] = await Promise.all([
        api.getSubscription(business.id).catch(() => null),
        api.getBillingLedger(business.id).catch(() => ({ ledger: [] })),
      ]);

      if (subRes) {
        setSubscriptionData(subRes);
      }
      if (ledgerRes && ledgerRes.ledger) {
        setLedgerEntries(Array.isArray(ledgerRes.ledger) ? ledgerRes.ledger : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBillingInfo();
  }, [business.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBillingInfo(true);
  };

  const handlePreviewUpgrade = async (targetPlan: 'TEAM' | 'BUSINESS', targetSeats: number) => {
    try {
      setPreviewLoading(true);
      const preview = await api.previewPlanChange(business.id, {
        newPlan: targetPlan,
        newSeats: targetSeats,
      });
      setProrationPreview(preview);
    } catch (err: any) {
      showToast(err.message || 'Could not calculate proration preview.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const currentPlan = subscriptionData?.subscription?.plan || 'STARTER';
  const currentStatus = subscriptionData?.subscription?.status || 'TRIALING';
  const totalSeats = subscriptionData?.subscription?.totalSeats || 5;
  const activeSeats = subscriptionData?.seatUsage?.activeMembers || 1;
  const seatPercentage = Math.min(100, Math.round((activeSeats / Math.max(1, totalSeats)) * 100));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Text style={styles.appBarTitle}>Subscription & Billing</Text>
          <Text style={styles.appBarSubtitle}>{business.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => fetchBillingInfo(true)}
          style={styles.refreshButton}
          accessibilityLabel="Refresh Billing"
        >
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        {error ? (
          <View style={{ marginBottom: Spacing.baseSpacing }}>
            <FeedbackBanner type="error" message={error} />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading subscription details...</Text>
          </View>
        ) : (
          <>
            {/* Current Plan Overview Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.planBadgeContainer}>
                  <Text style={styles.planBadgeText}>{currentPlan} PLAN</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    currentStatus === 'ACTIVE'
                      ? styles.statusActive
                      : currentStatus === 'PAST_DUE'
                      ? styles.statusPastDue
                      : styles.statusTrial,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      currentStatus === 'ACTIVE'
                        ? styles.statusActiveText
                        : currentStatus === 'PAST_DUE'
                        ? styles.statusPastDueText
                        : styles.statusTrialText,
                    ]}
                  >
                    {currentStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.planPricingTitle}>
                {currentPlan === 'BUSINESS'
                  ? '$120 / month'
                  : currentPlan === 'TEAM'
                  ? '$50 / month'
                  : '$20 / month'}
              </Text>
              <Text style={styles.planPricingSub}>
                Includes up to {totalSeats} team members with real-time shift sync
              </Text>

              {/* Seat Usage Bar */}
              <View style={styles.seatSection}>
                <View style={styles.seatLabelRow}>
                  <Text style={styles.seatLabel}>Team Seat Usage:</Text>
                  <Text style={styles.seatValue}>
                    {activeSeats} of {totalSeats} seats used ({seatPercentage}%)
                  </Text>
                </View>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${seatPercentage}%` },
                      seatPercentage >= 90 ? styles.progressBarWarning : null,
                    ]}
                  />
                </View>
              </View>

              {/* Upgrade Plan Call to Action */}
              <Button
                title="Upgrade / Change Plan (Flutterwave)"
                onPress={() => setUpgradeModalVisible(true)}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
            </View>

            {/* Proration & Fast Plan Preview */}
            <View style={styles.card}>
              <View style={styles.prorationHeaderRow}>
                <Ionicons name="calculator-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Mid-Cycle Plan Change & Proration</Text>
              </View>
              <Text style={styles.cardDesc}>
                Upgrade instantly with fair proration. You are only charged for the exact remaining days in your billing period.
              </Text>

              <View style={styles.previewBtnRow}>
                <TouchableOpacity
                  style={[styles.previewChip, previewLoading && { opacity: 0.6 }]}
                  onPress={() => handlePreviewUpgrade('TEAM', 15)}
                  disabled={previewLoading}
                >
                  <Text style={styles.previewChipText}>Preview Team (15 seats)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.previewChip, previewLoading && { opacity: 0.6 }]}
                  onPress={() => handlePreviewUpgrade('BUSINESS', 40)}
                  disabled={previewLoading}
                >
                  <Text style={styles.previewChipText}>Preview Business (40 seats)</Text>
                </TouchableOpacity>
              </View>

              {prorationPreview ? (
                <View style={styles.prorationResultBox}>
                  <Text style={styles.prorationTitle}>Proration Calculation:</Text>
                  <View style={styles.prorationLine}>
                    <Text style={styles.prorationLabel}>Days Remaining:</Text>
                    <Text style={styles.prorationValue}>{prorationPreview.daysRemaining ?? 20} days</Text>
                  </View>
                  <View style={styles.prorationLine}>
                    <Text style={styles.prorationLabel}>Credit for Unused Time:</Text>
                    <Text style={styles.prorationValue}>-${((prorationPreview.creditCents ?? 0) / 100).toFixed(2)}</Text>
                  </View>
                  <View style={styles.prorationLine}>
                    <Text style={styles.prorationLabel}>Cost of New Plan (Remaining):</Text>
                    <Text style={styles.prorationValue}>+${((prorationPreview.costCents ?? 0) / 100).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.prorationLine, styles.prorationTotalLine]}>
                    <Text style={styles.prorationTotalLabel}>Due Today:</Text>
                    <Text style={styles.prorationTotalValue}>
                      ${((prorationPreview.chargeTodayCents ?? 0) / 100).toFixed(2)}
                    </Text>
                  </View>

                  <Button
                    title="Proceed to Checkout with Flutterwave"
                    onPress={() => setUpgradeModalVisible(true)}
                    variant="tonal"
                    style={{ marginTop: Spacing.smallSpacing }}
                  />
                </View>
              ) : null}
            </View>

            {/* Flutterwave Security Card */}
            <View style={styles.securityBox}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityTitle}>Protected by Flutterwave</Text>
                <Text style={styles.securityDesc}>
                  PCI-DSS Level 1 certified gateway. Your payment details are encrypted and securely processed.
                </Text>
              </View>
            </View>

            {/* Billing Ledger & Transactions */}
            <View style={styles.card}>
              <View style={styles.ledgerHeaderRow}>
                <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>Billing Ledger & History</Text>
              </View>

              {ledgerEntries.length === 0 ? (
                <View style={styles.emptyLedger}>
                  <Text style={styles.emptyLedgerText}>
                    No billing ledger entries found yet. When you upgrade your plan via Flutterwave, transactions appear here.
                  </Text>
                </View>
              ) : (
                ledgerEntries.map((item, idx) => (
                  <View key={item.id || idx} style={styles.ledgerItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ledgerType}>{item.type || 'PAYMENT'}</Text>
                      <Text style={styles.ledgerDate}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'} • {item.description || 'Subscription charge'}
                      </Text>
                    </View>
                    <Text style={styles.ledgerAmount}>
                      ${item.amountCents ? (item.amountCents / 100).toFixed(2) : '0.00'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        visible={upgradeModalVisible}
        businessId={business.id}
        businessName={business.name}
        currentUserRole={(business as any).currentUserRole || 'OWNER'}
        currentActivePlan={currentPlan}
        onClose={() => {
          setUpgradeModalVisible(false);
          fetchBillingInfo();
        }}
      />
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
    borderBottomColor: Colors.neutralContainer,
    ...Effects.softShadow,
  },
  appBarLeft: {
    flex: 1,
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
    marginTop: 2,
  },
  refreshButton: {
    padding: Spacing.smallSpacing,
    borderRadius: 8,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  scrollContent: {
    padding: Spacing.baseSpacing,
    paddingBottom: Spacing.xLargeSpacing,
  },
  loadingContainer: {
    paddingVertical: Spacing.xLargeSpacing * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.smallSpacing,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: Spacing.baseSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    ...Effects.softShadow,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBadgeContainer: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.smallSpacing,
    paddingVertical: 3,
    borderRadius: 8,
  },
  planBadgeText: {
    ...Typography.labelSmall,
    color: Colors.onPrimaryContainer,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: Spacing.smallSpacing,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: Colors.successContainer,
  },
  statusActiveText: {
    color: Colors.onSuccessContainer,
    fontWeight: '700',
    fontSize: 11,
  },
  statusPastDue: {
    backgroundColor: Colors.errorContainer,
  },
  statusPastDueText: {
    color: Colors.onErrorContainer,
    fontWeight: '700',
    fontSize: 11,
  },
  statusTrial: {
    backgroundColor: Colors.tertiaryContainer,
  },
  statusTrialText: {
    color: Colors.onTertiaryContainer,
    fontWeight: '700',
    fontSize: 11,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planPricingTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: Colors.onSurface,
    marginTop: Spacing.smallSpacing,
  },
  planPricingSub: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  seatSection: {
    marginTop: Spacing.mediumSpacing,
    paddingTop: Spacing.smallSpacing,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralContainer,
  },
  seatLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  seatLabel: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  seatValue: {
    ...Typography.bodySmall,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressBarWarning: {
    backgroundColor: Colors.error,
  },
  prorationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smallSpacing,
    marginBottom: 4,
  },
  cardTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  cardDesc: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: Spacing.smallSpacing,
  },
  previewBtnRow: {
    flexDirection: 'row',
    gap: Spacing.smallSpacing,
    marginVertical: Spacing.smallSpacing,
  },
  previewChip: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    paddingVertical: Spacing.smallSpacing,
    paddingHorizontal: Spacing.smallSpacing,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewChipText: {
    ...Typography.labelSmall,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  prorationResultBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: Spacing.mediumSpacing,
    marginTop: Spacing.smallSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  prorationTitle: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.smallSpacing,
  },
  prorationLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  prorationLabel: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
  },
  prorationValue: {
    ...Typography.bodySmall,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  prorationTotalLine: {
    borderTopWidth: 1,
    borderTopColor: Colors.neutralContainer,
    paddingTop: Spacing.smallSpacing,
    marginTop: Spacing.smallSpacing,
  },
  prorationTotalLabel: {
    ...Typography.bodyMedium,
    color: Colors.onSurface,
    fontWeight: '800',
  },
  prorationTotalValue: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: '800',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    gap: Spacing.mediumSpacing,
    ...Effects.softShadow,
  },
  securityTitle: {
    ...Typography.labelLarge,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  securityDesc: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smallSpacing,
    marginBottom: Spacing.smallSpacing,
  },
  emptyLedger: {
    paddingVertical: Spacing.largeSpacing,
    alignItems: 'center',
  },
  emptyLedgerText: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  ledgerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.smallSpacing,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralContainer,
  },
  ledgerType: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  ledgerDate: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  ledgerAmount: {
    ...Typography.labelLarge,
    color: Colors.primary,
    fontWeight: '800',
  },
});
