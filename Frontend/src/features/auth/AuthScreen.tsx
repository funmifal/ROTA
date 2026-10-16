import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User } from '../../services/api';
import { VerifyEmailModal } from './VerifyEmailModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { MagicLinkModal } from './MagicLinkModal';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
  initialTab?: 'login' | 'signup';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, initialTab = 'signup' }) => {
  const [isLoginTab, setIsLoginTab] = useState(initialTab === 'login');

  // Verify email modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showMagicLinkModal, setShowMagicLinkModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field error states
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Field success states
  const [nameSuccess, setNameSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // General state
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetErrors = () => {
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setGeneralError('');
    setNameSuccess(false);
    setEmailSuccess(false);
    setPasswordSuccess(false);
  };

  // Parse name into structured parts supporting 2, 3, and >3 words (compound/middle names)
  const parseNameParts = (fullName: string) => {
    const trimmed = fullName.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 0) return { words, firstName: '', middleName: '', lastName: '' };
    if (words.length === 1) return { words, firstName: words[0], middleName: '', lastName: '' };
    if (words.length === 2) return { words, firstName: words[0], middleName: '', lastName: words[1] };
    if (words.length === 3) return { words, firstName: words[0], middleName: words[1], lastName: words[2] };
    // Edge case: more than 3 words (e.g. compound first, middle, or last names)
    return {
      words,
      firstName: words[0],
      middleName: words.slice(1, -1).join(' '),
      lastName: words[words.length - 1],
    };
  };

  const handleNameBlur = () => {
    // Trim empty spaces at the end
    const trimmed = name.trimEnd();
    setName(trimmed);

    if (!trimmed.trim()) {
      setNameError('Full Name field cannot be empty');
      setNameSuccess(false);
      return;
    }
    if (/[^a-zA-Z\s]/.test(trimmed)) {
      setNameError('Name Must Use Only Letters');
      setNameSuccess(false);
      return;
    }
    const words = trimmed.trim().split(/\s+/).filter(Boolean);
    // Ensure at least 2 words are entered (first word + space + subsequent word)
    if (words.length < 2) {
      setNameError('Please enter at least 2 words (e.g. first and last name)');
      setNameSuccess(false);
      return;
    }

    // Success state
    setNameError('');
    setNameSuccess(true);
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (nameSuccess) setNameSuccess(false);

    if (/[^a-zA-Z\s]/.test(text)) {
      setNameError('Name Must Use Only Letters');
    } else {
      const words = text.trim().split(/\s+/).filter(Boolean);
      if (nameError === 'Name Must Use Only Letters') {
        setNameError('');
      } else if (nameError === 'Please enter at least 2 words (e.g. first and last name)' && words.length >= 2) {
        setNameError('');
      } else if (nameError === 'Full Name field cannot be empty' && text.trim().length > 0) {
        setNameError('');
      }
    }
  };

  const handleNameKeyPress = (e: any) => {
    const key = e.nativeEvent?.key;
    if (key && key.length === 1 && /[^a-zA-Z\s]/.test(key)) {
      setNameError('Name Must Use Only Letters');
      setNameSuccess(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailSuccess) setEmailSuccess(false);

    // In create account form, validate email in real time
    if (!isLoginTab) {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setEmailError('');
      } else {
        // Stop displaying error the moment the user types a domain after @
        const hasDomain = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/.test(trimmed);
        if (hasDomain) {
          setEmailError('');
        } else {
          setEmailError('Enter A Valid Email Address');
        }
      }
    } else {
      if (emailError) setEmailError('');
    }
  };

  const handleEmailBlur = () => {
    // Trim empty spaces at the end and bounce down to lowercase to prevent casing conflicts
    const normalized = email.trim().toLowerCase();
    setEmail(normalized);

    if (!normalized) {
      setEmailError('Email Address field cannot be empty');
      setEmailSuccess(false);
      return;
    }
    const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalized)) {
      setEmailError('Enter A Valid Email Address');
      setEmailSuccess(false);
      return;
    }

    // Success state
    setEmailError('');
    setEmailSuccess(true);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordSuccess) setPasswordSuccess(false);
    if (passwordError) setPasswordError('');
  };

  const handlePasswordBlur = () => {
    // Trim empty spaces at the end
    const trimmed = password.trimEnd();
    setPassword(trimmed);

    if (!trimmed) {
      setPasswordError('Password field cannot be empty');
      setPasswordSuccess(false);
      return;
    }
    if (!isLoginTab) {
      if (trimmed.length < 8) {
        setPasswordError('Minimum Of 8 Characters');
        setPasswordSuccess(false);
        return;
      }
      if (trimmed.length > 64) {
        setPasswordError('Password must not exceed 64 characters');
        setPasswordSuccess(false);
        return;
      }
      if (!/[a-z]/.test(trimmed)) {
        setPasswordError('Password must contain a lowercase letter');
        setPasswordSuccess(false);
        return;
      }
      if (!/[A-Z]/.test(trimmed)) {
        setPasswordError('Password must contain an uppercase letter');
        setPasswordSuccess(false);
        return;
      }
      if (!/[0-9]/.test(trimmed)) {
        setPasswordError('Password must contain a number');
        setPasswordSuccess(false);
        return;
      }
      if (!/[#@>^\W_]/.test(trimmed)) {
        setPasswordError('Password must contain a special character(#@>^)');
        setPasswordSuccess(false);
        return;
      }
    }

    // Success state
    setPasswordError('');
    setPasswordSuccess(true);
  };

  const validate = (): boolean => {
    resetErrors();
    let isValid = true;

    // Validate Full Name for Sign Up
    if (!isLoginTab) {
      const trimmed = name.trim();
      if (!trimmed) {
        setNameError('Full Name field cannot be empty');
        isValid = false;
      } else if (/[^a-zA-Z\s]/.test(name)) {
        setNameError('Name Must Use Only Letters');
        isValid = false;
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          setNameError('Please enter at least 2 words (e.g. first and last name)');
          isValid = false;
        }
      }
    }

    // Validate Email Address
    const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      setEmailError('Email Address field cannot be empty');
      isValid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError('Enter A Valid Email Address');
      isValid = false;
    }

    // Validate Password (Length superior to composition: 8 min 64 max)
    if (!password) {
      setPasswordError('Password field cannot be empty');
      isValid = false;
    } else if (!isLoginTab) {
      if (password.length < 8) {
        setPasswordError('Minimum Of 8 Characters');
        isValid = false;
      } else if (password.length > 64) {
        setPasswordError('Password must not exceed 64 characters');
        isValid = false;
      } else if (!/[a-z]/.test(password)) {
        setPasswordError('Password must contain a lowercase letter');
        isValid = false;
      } else if (!/[A-Z]/.test(password)) {
        setPasswordError('Password must contain an uppercase letter');
        isValid = false;
      } else if (!/[0-9]/.test(password)) {
        setPasswordError('Password must contain a number');
        isValid = false;
      } else if (!/[#@>^\W_]/.test(password)) {
        setPasswordError('Password must contain a special character(#@>^)');
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setGeneralError('');

    try {
      if (isLoginTab) {
        const res = await api.login(email.trim().toLowerCase(), password);
        onAuthSuccess(res.user);
      } else {
        const nameParts = parseNameParts(name);
        const res = await api.register(name.trim(), email.trim().toLowerCase(), password, {
          firstName: nameParts.firstName,
          middleName: nameParts.middleName || undefined,
          lastName: nameParts.lastName,
        });
        setPendingUser(res.user);
        setShowVerifyModal(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during authentication';
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Button disabled when fields are not filled with data; enables when last piece of data is filled
  const isFormFilled = isLoginTab
    ? Boolean(email.trim() && password)
    : Boolean(name.trim() && email.trim() && password);

  // Real-time password requirement detection for Create Account
  // Length is superior to composition (8 min 64 max)
  const passwordRequirements = {
    hasMinLength: password.length >= 8,
    isWithinMaxLength: password.length <= 64,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[#@>^\W_]/.test(password),
  };

  // Hidden by default (when empty). As user types, displays each unmet requirement alone in real time.
  // Length is superior to composition (8 min 64 max):
  // Length requirement is prioritized and evaluated first before composition.
  const getActivePasswordRequirement = (): string | null => {
    if (password.length === 0) return null;
    if (!passwordRequirements.hasMinLength) {
      return 'Minimum Of 8 Characters';
    }
    if (!passwordRequirements.isWithinMaxLength) {
      return 'Password must not exceed 64 characters';
    }
    if (!passwordRequirements.hasLowercase) {
      return 'Password must contain a lowercase letter';
    }
    if (!passwordRequirements.hasUppercase) {
      return 'Password must contain an uppercase letter';
    }
    if (!passwordRequirements.hasNumber) {
      return 'Password must contain a number';
    }
    if (!passwordRequirements.hasSpecialChar) {
      return 'Password must contain a special character(#@>^)';
    }
    return null;
  };

  const activePasswordRequirement = getActivePasswordRequirement();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brandTitle}>Rota</Text>
          <Text style={styles.screenTitle}>
            {isLoginTab ? 'Welcome Back' : 'Create an Account'}
          </Text>
          <Text style={styles.screenSubtitle}>
            {isLoginTab
              ? 'Log in to manage shifts and schedules'
              : 'Sign up to manage your team and shifts'}
          </Text>
        </View>

        <View style={styles.card}>
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={() => {
                setIsLoginTab(true);
                resetErrors();
              }}
              style={[styles.tabButton, isLoginTab && styles.activeTabButton]}
            >
              <Text style={[styles.tabText, isLoginTab && styles.activeTabText]}>
                Log In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsLoginTab(false);
                resetErrors();
              }}
              style={[styles.tabButton, !isLoginTab && styles.activeTabButton]}
            >
              <Text style={[styles.tabText, !isLoginTab && styles.activeTabText]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {generalError ? (
            <FeedbackBanner type="error" message={generalError} />
          ) : null}

          {/* Register: Name Input */}
          {!isLoginTab && (
            <Input
              label="Full Name"
              value={name}
              onChangeText={handleNameChange}
              onKeyPress={handleNameKeyPress}
              onBlur={handleNameBlur}
              placeholder="e.g. Sarah Connor"
              autoCapitalize="words"
              error={nameError}
              success={nameSuccess}
            />
          )}

          {/* Email Input */}
          <Input
            label="Email Address"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            placeholder="name@business.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={emailError}
            success={emailSuccess}
          />

          {/* Password Input */}
          <Input
            label="Password"
            value={password}
            isPassword
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            placeholder={isLoginTab ? 'Enter your password' : '8 - 64 characters'}
            maxLength={64}
            autoCapitalize="none"
            error={passwordError}
            success={passwordSuccess}
          />

          {/* Forgot Password link on Login Tab */}
          {isLoginTab && (
            <TouchableOpacity
              onPress={() => setShowForgotPasswordModal(true)}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Password Requirement (Create Account only: hidden by default, displayed alone in real time as user types, length last) */}
          {!isLoginTab && activePasswordRequirement && (
            <View style={styles.passwordRequirementsContainer}>
              <View style={styles.requirementRow}>
                <Ionicons
                  name="ellipse-outline"
                  size={12}
                  color={Colors.neutral}
                  style={styles.requirementIcon}
                />
                <Text style={styles.requirementText}>
                  {activePasswordRequirement}
                </Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <Button
            title={isLoginTab ? 'Log In' : 'Create Account'}
            onPress={handleSubmit}
            disabled={!isFormFilled}
            loading={loading}
            style={styles.submitButton}
          />

          {/* Passwordless Magic Link Option (Login & Sign-up) */}
          <View style={styles.alternativeAuthContainer}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <Button
              title={isLoginTab ? 'Sign in with Magic Link' : 'Sign up with Magic Link'}
              variant="tonal"
              onPress={() => setShowMagicLinkModal(true)}
              style={{ marginTop: Spacing.smallSpacing }}
            />
          </View>
        </View>
      </ScrollView>

      {/* 6-Digit Email Verification Modal */}
      <VerifyEmailModal
        visible={showVerifyModal}
        email={email.trim().toLowerCase()}
        onSuccess={() => {
          setShowVerifyModal(false);
          if (pendingUser) {
            onAuthSuccess(pendingUser);
          }
        }}
        onClose={() => setShowVerifyModal(false)}
      />

      {/* Password Reset Modal (Single-use expiring token) */}
      <ForgotPasswordModal
        visible={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onSuccess={() => {
          setIsLoginTab(true);
        }}
      />

      {/* Passwordless Magic Link Modal */}
      <MagicLinkModal
        visible={showMagicLinkModal}
        onClose={() => setShowMagicLinkModal(false)}
        onAuthSuccess={onAuthSuccess}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.baseSpacing,
  },
  header: {
    marginBottom: Spacing.largeSpacing,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.smallSpacing,
  },
  screenTitle: {
    fontSize: Typography.headlineMedium.fontSize,
    lineHeight: Typography.headlineMedium.lineHeight,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  screenSubtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.neutral,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: Spacing.largeSpacing,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 8,
    padding: 4,
    marginBottom: Spacing.baseSpacing,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.smallSpacing,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: Colors.surfaceContainerLowest,
  },
  tabText: {
    fontSize: Typography.labelMedium.fontSize,
    lineHeight: Typography.labelMedium.lineHeight,
    fontWeight: Typography.labelMedium.fontWeight,
    color: Colors.neutral,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: Spacing.smallSpacing,
  },
  passwordRequirementsContainer: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 8,
    padding: Spacing.mediumSpacing,
    marginBottom: Spacing.baseSpacing,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  requirementsHeader: {
    fontSize: Typography.labelSmall.fontSize,
    lineHeight: Typography.labelSmall.lineHeight,
    fontWeight: '600',
    color: Colors.neutral,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementIcon: {
    marginRight: 6,
  },
  requirementText: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.neutral,
  },
  requirementMetText: {
    color: Colors.success,
    fontWeight: '500',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: Spacing.baseSpacing,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.primary,
    fontWeight: '600',
  },
  alternativeAuthContainer: {
    marginTop: Spacing.baseSpacing,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.smallSpacing,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surfaceContainer,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    color: Colors.neutral,
    fontWeight: '600',
  },
});
