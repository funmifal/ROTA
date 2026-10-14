import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api } from '../../services/api';

interface UpgradePlanModalProps {
  visible: boolean;
  businessId: string;
  businessName: string;
  currentUserRole?: string;
  onLogout?: () => void;
  onClose: () => void;
}

type BillingCycle = 'monthly' | 'yearly';
type PlanTier = 'STARTER' | 'TEAM' | 'BUSINESS';

interface PlanDetail {
  id: PlanTier;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyMonthlyPrice: number;
  yearlyBilled: number;
  seats: number;
  extraSeatPrice: number | null;
  isPopular?: boolean;
  highlights: string[];
}

const PLANS: PlanDetail[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Ideal for small cafes, kiosks & boutiques',
    monthlyPrice: 20,
    yearlyMonthlyPrice: 16,
    yearlyBilled: 192,
    seats: 5,
    extraSeatPrice: null,
    highlights: [
      'Up to 5 team member seats',
      'Shift scheduling & publishing',
      'Push & email notifications',
      'Staff availability tracking',
    ],
  },
  {
    id: 'TEAM',
    name: 'Team',
    tagline: 'Most popular for busy restaurants & clinics',
    monthlyPrice: 50,
    yearlyMonthlyPrice: 40,
    yearlyBilled: 480,
    seats: 15,
    extraSeatPrice: 3,
    isPopular: true,
    highlights: [
      'Up to 15 team seats included',
      'Additional seats at $3/month',
      'Automated shift swaps & approvals',
      'Quiet hours & timezone coordination',
      'Audit logs & real-time activity feed',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'For high-volume operations & multi-location stores',
    monthlyPrice: 120,
    yearlyMonthlyPrice: 96,
    yearlyBilled: 1152,
    seats: 40,
    extraSeatPrice: 2,
    highlights: [
      'Up to 40 team seats included',
      'Additional seats at only $2/month',
      'Advanced role & manager controls',
      'Prorated mid-cycle seat scaling',
      'Priority Flutterwave webhook processing',
    ],
  },
];

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  visible,
  businessId,
  businessName,
  currentUserRole,
  onLogout,
  onClose,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('TEAM');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [activePaymentUrl, setActivePaymentUrl] = useState<string | null>(null);

  const activePlanDetail = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];

  const handleCheckout = async (targetPlan?: PlanTier) => {
    const planToUse = targetPlan || selectedPlan;
    const planDetail = PLANS.find((p) => p.id === planToUse) || activePlanDetail;

    if (currentUserRole && currentUserRole !== 'OWNER') {
      const msg = `Only the business Owner can upgrade subscriptions (AUTHZ-006). Your current role is ${currentUserRole}.`;
      setError(msg);
      Alert.alert('Owner Action Required', msg);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessInfo('');
      setActivePaymentUrl(null);

      console.log(`[UpgradeModal] Initiating checkout for business ${businessId}, plan ${planToUse}`);

      const res = await api.initiateCheckout(businessId, {
        planId: planToUse,
        seats: planDetail.seats,
        currency: 'USD',
      });

      if (res.checkout && res.checkout.paymentUrl) {
        const paymentUrl = res.checkout.paymentUrl;
        setActivePaymentUrl(paymentUrl);
        setSuccessInfo('Opening secure Flutterwave payment gateway...');

        // Handle opening browser cleanly on Web and Native
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const opened = window.open(paymentUrl, '_blank');
          if (!opened) {
            window.location.href = paymentUrl;
          }
        } else {
          try {
            await Linking.openURL(paymentUrl);
          } catch (linkErr) {
            console.warn('[UpgradeModal] Direct Linking.openURL failed, prompting user:', linkErr);
            Alert.alert(
              'Checkout Ready',
              'Your secure Flutterwave link is ready. Tap Proceed to open your payment page.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Proceed to Payment',
                  onPress: () => Linking.openURL(paymentUrl).catch(() => {}),
                },
              ]
            );
          }
        }
      } else {
        throw new Error('No checkout payment URL returned from Flutterwave gateway.');
      }
    } catch (err: any) {
      console.error('[UpgradeModal] Checkout initiation error:', err);
      const errMsg = err.message || 'Unable to initiate Flutterwave checkout. Please try again.';
      setError(errMsg);

      if (
        errMsg.toLowerCase().includes('session') ||
        errMsg.toLowerCase().includes('authentication') ||
        errMsg.toLowerCase().includes('token')
      ) {
        Alert.alert(
          'Session Expired',
          'Your authentication session has expired. Please sign back in to complete your plan upgrade.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In Again',
              onPress: () => {
                onClose();
                onLogout?.();
              },
            },
          ]
        );
      } else {
        Alert.alert('Checkout Notice', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.badgeContainer}>
                <Ionicons name="sparkles" size={14} color={Colors.tertiary} />
                <Text style={styles.badgeText}>UPGRADE PLAN</Text>
              </View>
              <Text style={styles.title}>Supercharge {businessName}</Text>
              <Text style={styles.subtitle}>
                Unlock all premium scheduling, team collaboration, and notification features.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close Upgrade Modal"
            >
              <Ionicons name="close" size={24} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Feedback / Error Banners */}
            {error ? (
              <View style={styles.bannerSpacing}>
                <FeedbackBanner type="error" message={error} />
              </View>
            ) : null}

            {successInfo ? (
              <View style={styles.bannerSpacing}>
                <FeedbackBanner type="success" message={successInfo} />
              </View>
            ) : null}

            {/* Why Upgrade from Free Tier Card */}
            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsHeader}>Why Upgrade from Free Tier?</Text>
              <View style={styles.benefitRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>Scale Your Entire Team</Text>
                  <Text style={styles.benefitDesc}>
                    Grow past the 5-member limit with up to 15 (Team) or 40+ (Business) staff seats.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>Automated Shift Swaps & Conflict Prevention</Text>
                  <Text style={styles.benefitDesc}>
                    Allow staff to trade shifts with 1-tap peer acceptance and manager lock approval.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>Quiet Hours & Push Notifications</Text>
                  <Text style={styles.benefitDesc}>
                    Server-enforced quiet hours respect worker sleep schedules across all timezones.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>Auditing & Compliance Logs</Text>
                  <Text style={styles.benefitDesc}>
                    Complete immutable audit trails for every schedule change, swap, and invite.
                  </Text>
                </View>
              </View>
            </View>

            {/* Billing Cycle Toggle */}
            <View style={styles.cycleToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.cycleOption,
                  billingCycle === 'monthly' && styles.cycleOptionActive,
                ]}
                onPress={() => setBillingCycle('monthly')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.cycleOptionText,
                    billingCycle === 'monthly' && styles.cycleOptionTextActive,
                  ]}
                >
                  Monthly Billing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cycleOption,
                  billingCycle === 'yearly' && styles.cycleOptionActive,
                ]}
                onPress={() => setBillingCycle('yearly')}
                activeOpacity={0.8}
              >
                <View style={styles.yearlyLabelWrap}>
                  <Text
                    style={[
                      styles.cycleOptionText,
                      billingCycle === 'yearly' && styles.cycleOptionTextActive,
                    ]}
                  >
                    Annual Billing
                  </Text>
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>SAVE 20%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Plan Selection Cards */}
            <Text style={styles.plansHeader}>Select a Plan</Text>
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const displayPrice =
                billingCycle === 'yearly' ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    plan.isPopular && styles.planCardPopular,
                  ]}
                  onPress={() => setSelectedPlan(plan.id)}
                  activeOpacity={0.85}
                >
                  {plan.isPopular ? (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  ) : null}

                  <View style={styles.planCardHeader}>
                    <View style={styles.planNameWrap}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planTagline}>{plan.tagline}</Text>
                    </View>
                    <View style={styles.radioOuter}>
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceCurrency}>$</Text>
                    <Text style={styles.priceNumber}>{displayPrice}</Text>
                    <Text style={styles.priceInterval}>/ month</Text>
                  </View>

                  {billingCycle === 'yearly' ? (
                    <Text style={styles.yearlyNote}>
                      Billed annually at ${plan.yearlyBilled}/year (Save ${(plan.monthlyPrice * 12) - plan.yearlyBilled})
                    </Text>
                  ) : (
                    <Text style={styles.yearlyNote}>Billed monthly, cancel anytime</Text>
                  )}

                  <View style={styles.planDivider} />

                  <View style={styles.planFeaturesList}>
                    {plan.highlights.map((feat, index) => (
                      <View key={index} style={styles.planFeatureItem}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={isSelected ? Colors.primary : Colors.secondary}
                        />
                        <Text style={styles.planFeatureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.planCardActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.selectPlanButton,
                        isSelected && styles.selectPlanButtonActive,
                      ]}
                      onPress={() => {
                        setSelectedPlan(plan.id);
                        handleCheckout(plan.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.selectPlanButtonText,
                          isSelected && styles.selectPlanButtonTextActive,
                        ]}
                      >
                        {isSelected
                          ? `Upgrade to ${plan.name} ($${displayPrice}/mo)`
                          : `Choose ${plan.name}`}
                      </Text>
                      <Ionicons
                        name={isSelected ? 'arrow-forward' : 'chevron-forward'}
                        size={16}
                        color={isSelected ? Colors.onPrimary : Colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Trust & Guarantee Info */}
            <View style={styles.trustBox}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <View style={styles.trustTextWrap}>
                <Text style={styles.trustTitle}>Bank-Grade Flutterwave Security</Text>
                <Text style={styles.trustDesc}>
                  Payments are encrypted and processed by Flutterwave. Your card info is never stored on our servers.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.footer}>
            {/* Inline Footer Feedback */}
            {error ? (
              <View style={styles.footerBannerSpacing}>
                <FeedbackBanner type="error" message={error} />
              </View>
            ) : null}

            {successInfo ? (
              <View style={styles.footerBannerSpacing}>
                <FeedbackBanner type="success" message={successInfo} />
              </View>
            ) : null}

            {activePaymentUrl ? (
              <TouchableOpacity
                style={styles.openLinkButton}
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.open(activePaymentUrl, '_blank') || (window.location.href = activePaymentUrl);
                  } else {
                    Linking.openURL(activePaymentUrl).catch(() => {});
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.openLinkButtonText}>Tap to Open Checkout Page</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.footerPricingSummary}>
              <Text style={styles.summaryLabel}>Total Today:</Text>
              <Text style={styles.summaryValue}>
                ${billingCycle === 'yearly' ? activePlanDetail.yearlyBilled : activePlanDetail.monthlyPrice}
                <Text style={styles.summarySub}>
                  {billingCycle === 'yearly' ? ' /year' : ' /mo'}
                </Text>
              </Text>
            </View>

            <Button
              title={
                loading
                  ? 'Connecting to Flutterwave...'
                  : `Upgrade to ${activePlanDetail.name} Plan`
              }
              onPress={() => handleCheckout(selectedPlan)}
              loading={loading}
              disabled={loading}
              variant="primary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 29, 28, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    display: 'flex',
    flexDirection: 'column',
    ...Effects.mediumShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.largeSpacing,
    paddingBottom: Spacing.mediumSpacing,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralContainer,
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: Spacing.smallSpacing,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tertiaryContainer,
    paddingHorizontal: Spacing.smallSpacing,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.onTertiaryContainer,
    fontWeight: '700',
  },
  title: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.baseSpacing,
    paddingBottom: Spacing.largeSpacing,
  },
  bannerSpacing: {
    marginBottom: Spacing.mediumSpacing,
  },
  benefitsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    marginBottom: Spacing.baseSpacing,
    ...Effects.softShadow,
  },
  benefitsHeader: {
    ...Typography.titleSmall,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.mediumSpacing,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.mediumSpacing,
    gap: Spacing.smallSpacing,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  benefitDesc: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.baseSpacing,
  },
  cycleOption: {
    flex: 1,
    paddingVertical: Spacing.smallSpacing,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cycleOptionActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Effects.softShadow,
  },
  cycleOptionText: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  cycleOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  yearlyLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBadge: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.onPrimaryContainer,
  },
  plansHeader: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.smallSpacing,
  },
  planCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: Spacing.baseSpacing,
    borderWidth: 2,
    borderColor: Colors.neutralContainer,
    marginBottom: Spacing.baseSpacing,
    position: 'relative',
    ...Effects.softShadow,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  planCardPopular: {
    borderTopWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -11,
    right: Spacing.baseSpacing,
    backgroundColor: Colors.tertiary,
    paddingHorizontal: Spacing.smallSpacing,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    ...Typography.labelSmall,
    color: Colors.onTertiary,
    fontWeight: '800',
    fontSize: 10,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planNameWrap: {
    flex: 1,
  },
  planName: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  planTagline: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.smallSpacing,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.smallSpacing,
  },
  priceCurrency: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  priceNumber: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: Colors.onSurface,
    marginLeft: 2,
  },
  priceInterval: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginLeft: 4,
  },
  yearlyNote: {
    ...Typography.bodySmall,
    color: Colors.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  planDivider: {
    height: 1,
    backgroundColor: Colors.neutralContainer,
    marginVertical: Spacing.smallSpacing,
  },
  planFeaturesList: {
    gap: Spacing.smallSpacing,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smallSpacing,
  },
  planFeatureText: {
    ...Typography.bodySmall,
    color: Colors.onSurface,
    flex: 1,
  },
  trustBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: Spacing.mediumSpacing,
    gap: Spacing.smallSpacing,
    marginTop: Spacing.smallSpacing,
  },
  trustTextWrap: {
    flex: 1,
  },
  trustTitle: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  trustDesc: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.smallSpacing,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.baseSpacing,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralContainer,
    zIndex: 100,
    ...Effects.softShadow,
    elevation: 12,
  },
  footerBannerSpacing: {
    marginBottom: Spacing.smallSpacing,
  },
  openLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tertiary,
    paddingVertical: Spacing.smallSpacing,
    paddingHorizontal: Spacing.baseSpacing,
    borderRadius: 8,
    marginBottom: Spacing.smallSpacing,
    gap: 8,
  },
  openLinkButtonText: {
    ...Typography.labelMedium,
    color: Colors.onTertiary,
    fontWeight: '700',
  },
  planCardActionRow: {
    marginTop: Spacing.mediumSpacing,
  },
  selectPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingVertical: Spacing.smallSpacing,
    paddingHorizontal: Spacing.baseSpacing,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  selectPlanButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectPlanButtonText: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  selectPlanButtonTextActive: {
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  footerPricingSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.smallSpacing,
  },
  summaryLabel: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  summaryValue: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '800',
  },
  summarySub: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontWeight: '400',
  },
});

