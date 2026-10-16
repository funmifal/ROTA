import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
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

  const handleVerifyMagicLink = async (codeOverride?: string) => {
    const raw = codeOverride || token;
    const cleanCode = raw.trim().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the complete 6-digit login code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.verifyMagicLink(cleanCode);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired login code.');
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
              <Text style={styles.modalTitle}>Passwordless Magic Login</Text>
              <Text style={styles.modalSubtitle}>
                {step === 'request'
                  ? 'Sign in or create an account securely with an instant 6-digit email code.'
                  : `Enter the 6-digit code sent to ${email || 'your email'}, or tap the link in the email.`}
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
                title="Send 6-Digit Code"
                onPress={handleRequestMagicLink}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('verify')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Already have a 6-digit code? Enter it here</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>6-Digit Login Code</Text>
                <TextInput
                  style={styles.codeInput}
                  value={token}
                  onChangeText={(val) => {
                    const numeric = val.replace(/[^0-9]/g, '').slice(0, 6);
                    setToken(numeric);
                    setError('');
                    if (numeric.length === 6) {
                      handleVerifyMagicLink(numeric);
                    }
                  }}
                  placeholder="123456"
                  placeholderTextColor={Colors.neutral}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <Button
                title="Log In with Code"
                onPress={() => handleVerifyMagicLink()}
                loading={loading}
                disabled={token.length !== 6}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('request')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Didn't receive code? Resend email</Text>
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
  codeContainer: {
    width: '100%',
    marginTop: Spacing.smallSpacing,
    marginBottom: Spacing.smallSpacing,
  },
  codeLabel: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    height: 58,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: Colors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
