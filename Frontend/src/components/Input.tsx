import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  success?: boolean;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  success,
  containerStyle,
  style,
  onFocus,
  onBlur,
  isPassword,
  secureTextEntry,
  value,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Show toggle only when isPassword is true AND the user has started typing (value length > 0)
  const hasTyped = Boolean(value && String(value).length > 0);
  const showPasswordToggle = isPassword && hasTyped;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            isFocused ? styles.inputFocused : null,
            success && !error ? styles.inputSuccess : null,
            error ? styles.inputError : null,
            isPassword ? styles.passwordInput : null,
            style,
          ]}
          value={value}
          secureTextEntry={isPassword ? !isPasswordVisible : secureTextEntry}
          placeholderTextColor={Colors.neutral}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {showPasswordToggle ? (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.neutral}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.mediumSpacing,
    width: '100%',
  },
  label: {
    fontSize: Typography.labelMedium.fontSize,
    lineHeight: Typography.labelMedium.lineHeight,
    fontWeight: Typography.labelMedium.fontWeight,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  input: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
    borderRadius: 8,
    paddingHorizontal: Spacing.baseSpacing,
    paddingVertical: Spacing.mediumSpacing,
    minHeight: 48,
    width: '100%',
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.baseSpacing,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  inputSuccess: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.secondary,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.error,
    marginTop: 4,
  },
});
