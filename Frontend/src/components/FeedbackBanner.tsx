import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing } from '../theme/tokens';

export type FeedbackType = 'error' | 'success' | 'info';

interface FeedbackBannerProps {
  type: FeedbackType;
  message: string;
  style?: ViewStyle;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({
  type,
  message,
  style,
}) => {
  const getBannerStyle = () => {
    switch (type) {
      case 'success':
        return {
          container: styles.successContainer,
          text: styles.successText,
        };
      case 'info':
        return {
          container: styles.infoContainer,
          text: styles.infoText,
        };
      case 'error':
      default:
        return {
          container: styles.errorContainer,
          text: styles.errorText,
        };
    }
  };

  const currentStyle = getBannerStyle();

  return (
    <View style={[styles.baseContainer, currentStyle.container, style]}>
      <Text style={[styles.baseText, currentStyle.text]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    padding: Spacing.mediumSpacing,
    borderRadius: 8,
    marginVertical: Spacing.smallSpacing,
    width: '100%',
  },
  baseText: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
  },
  errorContainer: {
    backgroundColor: Colors.errorContainer,
  },
  errorText: {
    color: Colors.onErrorContainer,
  },
  successContainer: {
    backgroundColor: Colors.successContainer,
  },
  successText: {
    color: Colors.onSuccessContainer,
  },
  infoContainer: {
    backgroundColor: Colors.infoContainer,
  },
  infoText: {
    color: Colors.onInfoContainer,
  },
});
