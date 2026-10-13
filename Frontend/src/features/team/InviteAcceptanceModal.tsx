import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User, Business } from '../../services/api';

interface InviteAcceptanceModalProps {
  token: string | null;
  currentUser: User | null;
  onClose: () => void;
  onJoined: (user: User, business: Business) => void;
}

export const InviteAcceptanceModal: React.FC<InviteAcceptanceModalProps> = ({
  token,
  currentUser,
  onClose,
  onJoined,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState('');

  // Sign up fields for new users accepting invitation
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchInvite = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.getInvitationByToken(token);
        if (isMounted) {
          setInvitationData(res.invitation);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load invitation.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvite();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!token) return null;

  const handleAcceptLoggedIn = async () => {
    try {
      setSubmitting(true);
      setError('');
      const res = await api.acceptInvitation(token);
      const bizRes = await api.getBusiness(res.membership.businessId);
      onJoined(currentUser!, bizRes.business);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpAndJoin = async () => {
    if (!name.trim() || !password) {
      setError('Name and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.signUpWithInvitation(token, {
        name: name.trim(),
        password,
      });
      onJoined(res.user, res.business);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={Boolean(token)} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Team Invitation</Text>
              <Text style={styles.modalSubtitle}>You've been invited to join a workspace</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.neutral} />
            </TouchableOpacity>
          </View>

          {error ? <FeedbackBanner type="error" message={error} /> : null}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading invitation details...</Text>
            </View>
          ) : invitationData ? (
            <View>
              {/* Business Invitation Summary Card */}
              <View style={styles.inviteCard}>
                <View style={styles.businessIconContainer}>
                  <Ionicons name="business" size={28} color={Colors.primary} />
                </View>
                <Text style={styles.businessName}>{invitationData.businessName}</Text>
                <Text style={styles.invitedByText}>
                  Invited by {invitationData.invitedBy} • Role: {invitationData.role}
                </Text>
                <View style={styles.emailPill}>
                  <Text style={styles.emailPillText}>{invitationData.email}</Text>
                </View>
              </View>

              {currentUser ? (
                /* User already logged in -> single-tap acceptance */
                <View style={{ marginTop: Spacing.mediumSpacing }}>
                  <Text style={styles.loggedUserPrompt}>
                    You are logged in as <Text style={{ fontWeight: '700' }}>{currentUser.email}</Text>.
                  </Text>
                  <Button
                    title="Accept Invitation & Join Team"
                    onPress={handleAcceptLoggedIn}
                    loading={submitting}
                    variant="primary"
                    style={{ marginTop: Spacing.smallSpacing }}
                  />
                </View>
              ) : (
                /* New user -> sign up with pre-verified invite */
                <View style={{ marginTop: Spacing.smallSpacing }}>
                  <Text style={styles.formPrompt}>
                    Create your account to accept this invitation:
                  </Text>
                  <Input
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Kemi Adebayo"
                    autoCapitalize="words"
                  />
                  <Input
                    label="Password"
                    value={password}
                    isPassword
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    maxLength={64}
                  />
                  <Button
                    title="Sign Up & Enter Team"
                    onPress={handleSignUpAndJoin}
                    loading={submitting}
                    variant="primary"
                    style={{ marginTop: Spacing.mediumSpacing }}
                  />
                </View>
              )}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.baseSpacing,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: Spacing.largeSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.hardShadow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.mediumSpacing,
  },
  modalTitle: {
    fontSize: Typography.titleLarge.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  modalSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  inviteCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: Spacing.baseSpacing,
    alignItems: 'center',
    marginVertical: Spacing.smallSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  businessIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  businessName: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  invitedByText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
    marginTop: 2,
  },
  emailPill: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  emailPillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  loggedUserPrompt: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  formPrompt: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 8,
  },
});
