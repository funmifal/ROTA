import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, TeamMember, TeamInvitation, Business } from '../../services/api';
import { InviteMemberModal } from './InviteMemberModal';

interface TeamScreenProps {
  business: Business;
  currentUserRole: 'OWNER' | 'MANAGER' | 'STAFF';
  onBack: () => void;
}

export const TeamScreen: React.FC<TeamScreenProps> = ({
  business,
  currentUserRole,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const isOwner = currentUserRole === 'OWNER';
  const isManager = currentUserRole === 'MANAGER';
  const canManage = isOwner || isManager;

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [membersRes, invitesRes] = await Promise.all([
        api.getMembers(business.id),
        canManage ? api.getInvitations(business.id) : Promise.resolve({ invitations: [] }),
      ]);
      setMembers(membersRes.members);
      setInvitations(invitesRes.invitations);
    } catch (err: any) {
      setError(err.message || 'Failed to load team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business.id]);

  const handleRemoveMember = (member: TeamMember) => {
    if (member.role === 'OWNER') {
      Alert.alert('Cannot Remove', 'The business Owner cannot be removed.');
      return;
    }

    if (isManager && member.role === 'MANAGER') {
      Alert.alert('Permission Denied', 'Managers cannot remove other Managers.');
      return;
    }

    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${member.name} from ${business.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeMember(business.id, member.membershipId);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeInvite = (invitation: TeamInvitation) => {
    Alert.alert(
      'Revoke Invitation',
      `Revoke invitation for ${invitation.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.revokeInvitation(business.id, invitation.id);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke invitation.');
            }
          },
        },
      ]
    );
  };

  const renderRoleBadge = (role: 'OWNER' | 'MANAGER' | 'STAFF') => {
    let bg: string = Colors.neutralContainer;
    let textColor: string = Colors.onNeutralContainer;

    if (role === 'OWNER') {
      bg = Colors.primaryContainer;
      textColor = Colors.onPrimaryContainer;
    } else if (role === 'MANAGER') {
      bg = Colors.secondaryContainer;
      textColor = Colors.onSecondaryContainer;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>{role}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Team Management</Text>
          <Text style={styles.subtitle}>{business.name}</Text>
        </View>
        {canManage ? (
          <TouchableOpacity
            style={styles.inviteHeaderButton}
            onPress={() => setInviteModalVisible(true)}
          >
            <Ionicons name="person-add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {/* Tabs */}
      {canManage && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.activeTab]}
            onPress={() => setActiveTab('members')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'members' && styles.activeTabText,
              ]}
            >
              Members ({members.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'invitations' && styles.activeTab]}
            onPress={() => setActiveTab('invitations')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'invitations' && styles.activeTabText,
              ]}
            >
              Invited ({invitations.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? <FeedbackBanner type="error" message={error} /> : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.membershipId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.memberCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {renderRoleBadge(item.role)}
                </View>
                <Text style={styles.memberEmail}>{item.email}</Text>
              </View>

              {canManage && item.role !== 'OWNER' && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item)}
                  style={styles.moreButton}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No members found.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.memberCard}>
              <View style={[styles.avatar, { backgroundColor: Colors.surfaceContainerHigh }]}>
                <Ionicons name="mail-outline" size={20} color={Colors.neutral} />
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{item.email}</Text>
                  {renderRoleBadge(item.role)}
                </View>
                <Text style={styles.memberEmail}>Pending acceptance</Text>
              </View>

              <TouchableOpacity
                onPress={() => handleRevokeInvite(item)}
                style={styles.moreButton}
              >
                <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No pending invitations.</Text>
            </View>
          }
        />
      )}

      {canManage && (
        <View style={styles.bottomBar}>
          <Button
            title="Invite Team Member"
            onPress={() => setInviteModalVisible(true)}
            variant="primary"
          />
        </View>
      )}

      <InviteMemberModal
        visible={inviteModalVisible}
        businessId={business.id}
        currentUserRole={currentUserRole}
        onSuccess={() => {
          loadData();
        }}
        onClose={() => setInviteModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.largeSpacing,
    paddingBottom: Spacing.mediumSpacing,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  inviteHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: Spacing.baseSpacing,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '500',
    color: Colors.neutral,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.baseSpacing,
    gap: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.mediumSpacing,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.mediumSpacing,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  memberName: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  memberEmail: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  moreButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: Typography.bodyMedium.fontSize,
    color: Colors.neutral,
  },
  bottomBar: {
    padding: Spacing.baseSpacing,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
});
