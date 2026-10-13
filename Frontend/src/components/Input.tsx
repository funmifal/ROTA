import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  success?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  success,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          isFocused ? styles.inputFocused : null,
          success && !error ? styles.inputSuccess : null,
          error ? styles.inputError : null,
          style,
        ]}
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
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
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
