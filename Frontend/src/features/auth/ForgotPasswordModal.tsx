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
import { api } from '../../services/api';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRequestReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setSuccessMessage(res.message);
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    if (!token.trim()) {
      setError('Please enter the reset token from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.resetPassword(token.trim(), newPassword);
      setSuccessMessage(res.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setStep('request');
    setError('');
    setSuccessMessage('');
    setEmail('');
    setToken('');
    setNewPassword('');
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
              <Text style={styles.modalTitle}>
                {step === 'request' ? 'Reset Password' : 'Enter New Password'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {step === 'request'
                  ? 'We will send a single-use expiring reset link to your email.'
                  : 'Enter the single-use reset token from your email.'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleModalClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.neutral} />
            </TouchableOpacity>
          </View>

          {error ? <FeedbackBanner type="error" message={error} /> : null}
          {successMessage ? <FeedbackBanner type="success" message={successMessage} /> : null}

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
                title="Send Reset Link"
                onPress={handleRequestReset}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('reset')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Already have a reset token? Enter it here</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Input
                label="Reset Token"
                value={token}
                onChangeText={(val) => {
                  setToken(val);
                  setError('');
                }}
                placeholder="Paste the 64-character token"
                autoCapitalize="none"
              />
              <Input
                label="New Password"
                value={newPassword}
                isPassword
                onChangeText={(val) => {
                  setNewPassword(val);
                  setError('');
                }}
                placeholder="At least 8 characters"
                maxLength={64}
              />
              <Button
                title="Save New Password"
                onPress={handleCompleteReset}
                loading={loading}
                variant="primary"
                style={{ marginTop: Spacing.mediumSpacing }}
              />
              <TouchableOpacity
                onPress={() => setStep('request')}
                style={styles.switchStepLink}
              >
                <Text style={styles.switchStepText}>Back to request link</Text>
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
