import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, TeamInvitation } from '../../services/api';

interface InviteMemberModalProps {
  visible: boolean;
  businessId: string;
  currentUserRole: 'OWNER' | 'MANAGER' | 'STAFF';
  onSuccess: () => void;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  visible,
  businessId,
  currentUserRole,
  onSuccess,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'STAFF' | 'MANAGER'>('STAFF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdInvitation, setCreatedInvitation] = useState<{
    invitation: TeamInvitation;
    inviteUrl: string;
  } | null>(null);

  const isOwner = currentUserRole === 'OWNER';

  const handleSendInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.inviteMember(businessId, {
        email: trimmed,
        role,
      });

      setCreatedInvitation({
        invitation: res.invitation,
        inviteUrl: res.inviteUrl,
      });
      setEmail('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCreatedInvitation(null);
    setEmail('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-add" size={24} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.neutral} />
            </TouchableOpacity>
          </View>

          {createdInvitation ? (
            <View>
              <Text style={styles.title}>Invitation Sent!</Text>
              <Text style={styles.subtitle}>
                An email was sent to{' '}
                <Text style={{ fontWeight: '600', color: Colors.primary }}>
                  {createdInvitation.invitation.email}
                </Text>
                . You can also copy the direct invitation link below to share manually:
              </Text>

              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={2}>
                  {createdInvitation.inviteUrl}
                </Text>
              </View>

              <Button
                title="Done"
                onPress={handleClose}
                variant="primary"
                style={{ marginTop: Spacing.baseSpacing }}
              />
            </View>
          ) : (
            <View>
              <Text style={styles.title}>Invite Team Member</Text>
              <Text style={styles.subtitle}>
                Invite colleagues to your business team by email or direct link.
              </Text>

              {error ? <FeedbackBanner type="error" message={error} /> : null}

              <Input
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                placeholder="colleague@business.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.roleLabel}>Role</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'STAFF' && styles.activeRoleCard,
                  ]}
                  onPress={() => setRole('STAFF')}
                >
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'STAFF' && styles.activeRoleTitle,
                    ]}
                  >
                    Staff
                  </Text>
                  <Text style={styles.roleDesc}>
                    Can view schedules, set availability, and request shift swaps.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'MANAGER' && styles.activeRoleCard,
                    !isOwner && styles.disabledRoleCard,
                  ]}
                  disabled={!isOwner}
                  onPress={() => setRole('MANAGER')}
                >
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'MANAGER' && styles.activeRoleTitle,
                    ]}
                  >
                    Manager
                  </Text>
                  <Text style={styles.roleDesc}>
                    Can build & publish schedules, manage shifts, and approve swaps.
                    {!isOwner ? ' (Owner only)' : ''}
                  </Text>
                </TouchableOpacity>
              </View>

              <Button
                title="Send Invitation"
                onPress={handleSendInvite}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.baseSpacing }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.largeSpacing,
    ...Effects.hardShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.smallSpacing,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 6,
  },
  title: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.neutral,
    marginBottom: Spacing.baseSpacing,
  },
  roleLabel: {
    fontSize: Typography.labelMedium.fontSize,
    lineHeight: Typography.labelMedium.lineHeight,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: Spacing.smallSpacing,
  },
  roleSelector: {
    gap: 10,
    marginBottom: Spacing.baseSpacing,
  },
  roleCard: {
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    borderRadius: 10,
    padding: Spacing.mediumSpacing,
    backgroundColor: Colors.surfaceContainerLow,
  },
  activeRoleCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
  disabledRoleCard: {
    opacity: 0.5,
  },
  roleTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  activeRoleTitle: {
    color: Colors.onPrimaryContainer,
  },
  roleDesc: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  linkContainer: {
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing.baseSpacing,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    marginVertical: Spacing.baseSpacing,
  },
  linkText: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
