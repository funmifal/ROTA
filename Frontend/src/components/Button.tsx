import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'tonal' | 'destructive';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'tonal':
        return styles.tonalContainer;
      case 'destructive':
        return styles.destructiveContainer;
      case 'primary':
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'tonal':
        return styles.tonalText;
      case 'destructive':
        return styles.destructiveText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  const spinnerColor =
    variant === 'tonal' ? Colors.onPrimaryContainer : Colors.onPrimary;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseContainer,
        getContainerStyle(),
        (disabled || loading) && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <Text style={[styles.baseText, getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    paddingVertical: Spacing.mediumSpacing,
    paddingHorizontal: Spacing.baseSpacing,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  baseText: {
    fontSize: Typography.labelLarge.fontSize,
    lineHeight: Typography.labelLarge.lineHeight,
    fontWeight: Typography.labelLarge.fontWeight,
  },
  primaryContainer: {
    backgroundColor: Colors.primary,
  },
  primaryText: {
    color: Colors.onPrimary,
  },
  tonalContainer: {
    backgroundColor: Colors.primaryContainer,
  },
  tonalText: {
    color: Colors.onPrimaryContainer,
  },
  destructiveContainer: {
    backgroundColor: Colors.error,
  },
  destructiveText: {
    color: Colors.onError,
  },
  disabledContainer: {
    opacity: 0.5,
  },
});
