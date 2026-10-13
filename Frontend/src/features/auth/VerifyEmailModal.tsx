import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api } from '../../services/api';

interface VerifyEmailModalProps {
  visible: boolean;
  email: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const VerifyEmailModal: React.FC<VerifyEmailModalProps> = ({
  visible,
  email,
  onSuccess,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.verifyCode(email, trimmed);
      setSuccessMessage(res.message || 'Email verified successfully!');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');

    try {
      setResendCooldown(30);
      await api.resendVerification(email);
      setSuccessMessage('A fresh verification code has been sent to your email.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code.';
      setError(msg);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.neutral} />
          </TouchableOpacity>

          {/* Icon Header */}
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to:
          </Text>
          <View style={styles.emailChip}>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Feedback Banner */}
          {error ? <FeedbackBanner type="error" message={error} /> : null}
          {successMessage ? <FeedbackBanner type="success" message={successMessage} /> : null}

          {/* 6-digit input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(text) => {
                const numericOnly = text.replace(/[^0-9]/g, '');
                setCode(numericOnly);
                if (error) setError('');
              }}
              placeholder="000000"
              placeholderTextColor={Colors.neutralContainer}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          {/* Action Button */}
          <Button
            title="Verify & Continue"
            onPress={handleVerify}
            loading={loading}
            disabled={code.length !== 6 || loading}
            style={styles.verifyButton}
          />

          {/* Resend Action */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
              <Text
                style={[
                  styles.resendLink,
                  resendCooldown > 0 && styles.resendDisabled,
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.baseSpacing,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    padding: Spacing.largeSpacing,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.baseSpacing,
  },
  title: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.neutral,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailChip: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    marginBottom: Spacing.baseSpacing,
  },
  emailText: {
    fontSize: Typography.labelMedium.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  inputContainer: {
    width: '100%',
    marginVertical: Spacing.baseSpacing,
    alignItems: 'center',
  },
  codeInput: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 10,
    color: Colors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    outlineWidth: 0,
  },
  verifyButton: {
    width: '100%',
    marginTop: Spacing.smallSpacing,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.baseSpacing,
  },
  resendText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  resendLink: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  resendDisabled: {
    color: Colors.neutral,
    opacity: 0.6,
  },
});
