import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { Business, api } from '../../services/api';
import { useUpcomingShifts, useRequestSwap } from './useShiftsQuery';
import { useAppStore } from '../../state/useAppStore';

interface ShiftsScreenProps {
  business: Business;
  onBack: () => void;
}

export const ShiftsScreen: React.FC<ShiftsScreenProps> = ({ business, onBack }) => {
  const { data, isLoading, isError, error, refetch, isFetching } = useUpcomingShifts(business.id);
  const { mutate: requestSwap, isPending: isSwapping } = useRequestSwap(business.id);

  // Client Zustand testing state
  const isSimulatedOffline = useAppStore((s) => s.isSimulatedOffline);
  const setSimulatedOffline = useAppStore((s) => s.setSimulatedOffline);
  const shouldSimulateSwapFailure = useAppStore((s) => s.shouldSimulateSwapFailure);
  const setShouldSimulateSwapFailure = useAppStore((s) => s.setShouldSimulateSwapFailure);
  const showToast = useAppStore((s) => s.showToast);

  const [seeding, setSeeding] = useState(false);
  const [activeSubmittingId, setActiveSubmittingId] = useState<string | null>(null);

  const handleSeedShifts = async () => {
    try {
      setSeeding(true);
      const res = await api.seedUpcomingShifts(business.id);
      showToast(res.message, 'success');
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Failed to seed shifts', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleRequestSwap = (shiftAssignmentId: string, shiftTitle: string) => {
    setActiveSubmittingId(shiftAssignmentId);
    requestSwap(
      {
        shiftAssignmentId,
        reason: 'Personal scheduling conflict',
      },
      {
        onSettled: () => {
          setActiveSubmittingId(null);
        },
      }
    );
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatLastUpdated = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const shifts = data?.shifts || [];
  const isOffline = data?.isOffline || isSimulatedOffline;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>Upcoming Shifts</Text>
          <Text style={styles.appBarSubtitle}>{business.name}</Text>
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
        {/* Offline / Cache Status Badge (Requirement 2: Persisted state with visible last updated time) */}
        <View
          style={[
            styles.syncStatusCard,
            isOffline ? styles.syncStatusOffline : styles.syncStatusOnline,
          ]}
        >
          <View style={styles.syncStatusLeft}>
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'cloud-done-outline'}
              size={18}
              color={isOffline ? Colors.warning : Colors.success}
            />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.syncStatusTitle}>
                {isOffline ? 'Offline Cache Active' : 'Live Server Sync'}
              </Text>
              <Text style={styles.syncStatusSubtitle}>
                Last updated: {formatLastUpdated(data?.lastUpdated || null)}
              </Text>
            </View>
          </View>
          {isFetching && (
            <ActivityIndicator size="small" color={Colors.primary} />
          )}
        </View>

        {/* State Management Testing Controls Banner */}
        <View style={styles.testingControlsCard}>
          <Text style={styles.testingControlsTitle}>State & Rollback Playground</Text>
          <Text style={styles.testingControlsSubtitle}>
            Test offline viewing and optimistic swap request with server rollback:
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Simulate Offline Mode</Text>
              <Text style={styles.toggleSubtext}>
                Disconnects network & loads persisted shifts from local storage
              </Text>
            </View>
            <Switch
              value={isSimulatedOffline}
              onValueChange={(val) => setSimulatedOffline(val)}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryContainer }}
              thumbColor={isSimulatedOffline ? Colors.primary : Colors.neutralContainer}
            />
          </View>

          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Simulate Server Failure on Swap</Text>
              <Text style={styles.toggleSubtext}>
                Triggers server error to test optimistic UI rollback to previous state
              </Text>
            </View>
            <Switch
              value={shouldSimulateSwapFailure}
              onValueChange={(val) => setShouldSimulateSwapFailure(val)}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.errorContainer }}
              thumbColor={shouldSimulateSwapFailure ? Colors.error : Colors.neutralContainer}
            />
          </View>
        </View>

        {isError && (
          <FeedbackBanner
            type="error"
            message={error?.message || 'Failed to load shifts from server.'}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && !data ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading shift schedule...</Text>
          </View>
        ) : shifts.length === 0 ? (
          /* Empty State with Seed helper */
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={Colors.neutral} />
            <Text style={styles.emptyTitle}>No Upcoming Shifts</Text>
            <Text style={styles.emptySubtitle}>
              There are no published upcoming shifts for this business yet.
            </Text>
            <Button
              title="Add Sample Upcoming Shifts"
              onPress={handleSeedShifts}
              loading={seeding}
              variant="primary"
              style={{ marginTop: Spacing.mediumSpacing }}
            />
          </View>
        ) : (
          /* Shifts List */
          <View>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listSectionTitle}>
                {shifts.length} Upcoming Shift{shifts.length === 1 ? '' : 's'}
              </Text>
              <TouchableOpacity onPress={handleSeedShifts} disabled={seeding}>
                <Text style={styles.addMoreLink}>+ Add Sample Shifts</Text>
              </TouchableOpacity>
            </View>

            {shifts.map((shift) => {
              const isPendingSwap = shift.swapStatus === 'PENDING';
              const isSubmittingThis = activeSubmittingId === shift.myAssignmentId;

              return (
                <View key={shift.id} style={styles.shiftCard}>
                  {/* Shift Top Row */}
                  <View style={styles.shiftTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shiftTitle}>{shift.title}</Text>
                      <Text style={styles.shiftTime}>
                        {formatDateTime(shift.startTime)} – {formatDateTime(shift.endTime)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        isPendingSwap ? styles.statusPillWarning : styles.statusPillPublished,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isPendingSwap ? styles.statusPillTextWarning : styles.statusPillTextPublished,
                        ]}
                      >
                        {isPendingSwap ? 'SWAP REQUESTED' : shift.status}
                      </Text>
                    </View>
                  </View>

                  {/* Metadata Chips */}
                  <View style={styles.chipsRow}>
                    {shift.department ? (
                      <View style={styles.chip}>
                        <Ionicons name="briefcase-outline" size={12} color={Colors.neutral} />
                        <Text style={styles.chipText}>{shift.department}</Text>
                      </View>
                    ) : null}
                    {shift.location ? (
                      <View style={styles.chip}>
                        <Ionicons name="location-outline" size={12} color={Colors.neutral} />
                        <Text style={styles.chipText}>{shift.location}</Text>
                      </View>
                    ) : null}
                    {shift.breakMinutes > 0 ? (
                      <View style={styles.chip}>
                        <Ionicons name="cafe-outline" size={12} color={Colors.neutral} />
                        <Text style={styles.chipText}>{shift.breakMinutes}m break</Text>
                      </View>
                    ) : null}
                  </View>

                  {shift.notes ? (
                    <Text style={styles.shiftNotes}>{shift.notes}</Text>
                  ) : null}

                  {/* Shift Swap Action (Optimistic Update Demo) */}
                  <View style={styles.shiftActionRow}>
                    {shift.isAssignedToMe ? (
                      <View style={styles.assignmentBadge}>
                        <Ionicons name="person" size={12} color={Colors.primary} />
                        <Text style={styles.assignmentBadgeText}>Assigned to You</Text>
                      </View>
                    ) : (
                      <View style={styles.assignmentBadgeNeutral}>
                        <Ionicons name="people-outline" size={12} color={Colors.neutral} />
                        <Text style={styles.assignmentBadgeNeutralText}>
                          {shift.assignedStaffCount} Staff Assigned
                        </Text>
                      </View>
                    )}

                    {/* Swap Request Button with Optimistic UI & Disabled State */}
                    {isPendingSwap ? (
                      <View style={styles.pendingSwapBadge}>
                        <Ionicons name="hourglass-outline" size={14} color={Colors.warning} />
                        <Text style={styles.pendingSwapText}>
                          Swap Requested (Pending Approval)
                        </Text>
                      </View>
                    ) : shift.canRequestSwap && shift.myAssignmentId ? (
                      <Button
                        title="Request Swap"
                        variant="tonal"
                        loading={isSubmittingThis}
                        disabled={isSubmittingThis || !shift.canRequestSwap}
                        onPress={() =>
                          handleRequestSwap(shift.myAssignmentId!, shift.title)
                        }
                        style={styles.swapButton}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
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
  syncStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.mediumSpacing,
    borderRadius: 10,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
  },
  syncStatusOnline: {
    backgroundColor: Colors.successContainer,
    borderColor: Colors.success,
  },
  syncStatusOffline: {
    backgroundColor: Colors.warningContainer,
    borderColor: Colors.warning,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusTitle: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  syncStatusSubtitle: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.neutral,
    marginTop: 1,
  },
  testingControlsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  testingControlsTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  testingControlsSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 2,
    marginBottom: Spacing.smallSpacing,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  toggleLabel: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  toggleSubtext: {
    fontSize: 11,
    color: Colors.neutral,
    marginTop: 1,
    paddingRight: 10,
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
  emptyCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.largeSpacing,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  emptyTitle: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.smallSpacing,
  },
  listSectionTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  addMoreLink: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.primary,
    fontWeight: '600',
  },
  shiftCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  shiftTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shiftTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  shiftTime: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 3,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillPublished: {
    backgroundColor: Colors.primaryContainer,
  },
  statusPillWarning: {
    backgroundColor: Colors.warningContainer,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextPublished: {
    color: Colors.onPrimaryContainer,
  },
  statusPillTextWarning: {
    color: Colors.warning,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.smallSpacing,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surfaceContainerLow,
  },
  chipText: {
    fontSize: 11,
    color: Colors.neutral,
  },
  shiftNotes: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.smallSpacing,
    fontStyle: 'italic',
  },
  shiftActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.baseSpacing,
    paddingTop: Spacing.smallSpacing,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  assignmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignmentBadgeText: {
    fontSize: 11,
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
  },
  assignmentBadgeNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignmentBadgeNeutralText: {
    fontSize: 11,
    color: Colors.neutral,
  },
  pendingSwapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.warningContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pendingSwapText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.warning,
  },
  swapButton: {
    minHeight: 34,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
});
