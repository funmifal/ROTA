import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors, Typography, Spacing } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          style,
        ]}
        placeholderTextColor={Colors.neutral}
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
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.error,
    marginTop: 4,
  },
});
