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
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, User } from '../../services/api';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLoginTab, setIsLoginTab] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field error states
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // General state
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetErrors = () => {
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setGeneralError('');
  };

  const validate = (): boolean => {
    resetErrors();
    let isValid = true;

    if (!isLoginTab && name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (isLoginTab) {
      if (!password) {
        setPasswordError('Password is required');
        isValid = false;
      }
    } else {
      if (password.length < 8) {
        setPasswordError('Password must be at least 8 characters');
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
        const res = await api.login(email.trim(), password);
        onAuthSuccess(res.user);
      } else {
        const res = await api.register(name.trim(), email.trim(), password);
        onAuthSuccess(res.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during authentication';
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

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
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              placeholder="e.g. Sarah Connor"
              autoCapitalize="words"
              error={nameError}
            />
          )}

          {/* Email Input */}
          <Input
            label="Email Address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            placeholder="name@business.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={emailError}
          />

          {/* Password Input */}
          <Input
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError('');
            }}
            placeholder={isLoginTab ? 'Enter your password' : 'Min. 8 characters'}
            secureTextEntry
            autoCapitalize="none"
            error={passwordError}
          />

          {/* Submit Button */}
          <Button
            title={isLoginTab ? 'Log In' : 'Create Account'}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
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
});
