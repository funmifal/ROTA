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
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User } from '../../services/api';

interface MagicLinkModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({
  visible,
  onClose,
  onAuthSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleRequestMagicLink = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.requestMagicLink(email.trim().toLowerCase());
      setInfoMessage(res.message);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMagicLink = async () => {
    if (!token.trim()) {
      setError('Please enter the token from your magic link email.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.verifyMagicLink(token.trim());
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to verify magic link.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setStep('request');
    setError('');
    setInfoMessage('');
    setEmail('');
    setToken('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Passwordless Magic Link</Text>
              <Text style={styles.modalSubtitle}>
                {step === 'request'
                  ? 'Sign in securely without a password using an instant email link.'
                  : 'Check your email for the magic login link or paste the token below.'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleModalClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.neutral} />
            </TouchableOpacity>
          </View>

          {error ? <FeedbackBanner type="error" message={error} /> : null}
          {infoMessage ? <FeedbackBanner type="info" message={infoMessage} /> : null}

          {step === 'request' ? (
            <View>
              <Input
                label="Email Address"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError('');
                }}
                placeholder="name@business.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Button
                title="Send Magic Login Link"
                onPress={handleRequestMagicLink}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('verify')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Already have a magic link token? Enter it here</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Input
                label="Magic Link Token"
                value={token}
                onChangeText={(val) => {
                  setToken(val);
                  setError('');
                }}
                placeholder="Paste the token from your email"
                autoCapitalize="none"
              />
              <Button
                title="Log In with Token"
                onPress={handleVerifyMagicLink}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('request')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Resend email link</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
  modalHeader: {
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
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  switchStepLink: {
    marginTop: Spacing.mediumSpacing,
    alignItems: 'center',
  },
  switchStepText: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.primary,
    fontWeight: '600',
  },
});
