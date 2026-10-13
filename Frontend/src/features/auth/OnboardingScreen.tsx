import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import { Button } from '../../components/Button';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onStartCreateAccount: () => void;
  onGoToLogin: () => void;
}

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'calendar-outline',
    title: 'Smart Workforce Scheduling',
    description: 'Build, manage, and publish team shift rosters in minutes without scheduling conflicts.',
  },
  {
    id: '2',
    icon: 'swap-horizontal-outline',
    title: 'Effortless Shift Swaps',
    description: 'Empower staff to trade shifts with eligible team members under seamless manager approval.',
  },
  {
    id: '3',
    icon: 'notifications-outline',
    title: 'Instant Team Notifications',
    description: 'Keep your entire workforce aligned with instant shift alerts, roster publications, and real-time updates.',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onStartCreateAccount,
  onGoToLogin,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== activeSlide && slideIndex >= 0 && slideIndex < SLIDES.length) {
      setActiveSlide(slideIndex);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header with Skip */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>Rota</Text>
        <TouchableOpacity onPress={onStartCreateAccount} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Carousel */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.iconCircle}>
              <Ionicons name={slide.icon} size={48} color={Colors.primary} />
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideDescription}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              activeSlide === index ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <Button
          title="Create Account"
          onPress={onStartCreateAccount}
          style={styles.actionButton}
        />
        <TouchableOpacity onPress={onGoToLogin} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: 'space-between',
    paddingVertical: Spacing.largeSpacing,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.mediumSpacing,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  skipButtonText: {
    fontSize: Typography.labelMedium.fontSize,
    color: Colors.neutral,
    fontWeight: '500',
  },
  carousel: {
    flexGrow: 0,
  },
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: Spacing.largeSpacing,
    paddingVertical: Spacing.largeSpacing,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.largeSpacing,
  },
  slideTitle: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.mediumSpacing,
  },
  slideDescription: {
    fontSize: Typography.bodyLarge.fontSize,
    lineHeight: Typography.bodyLarge.lineHeight,
    color: Colors.neutral,
    textAlign: 'center',
    maxWidth: 320,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.baseSpacing,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: Colors.neutralContainer,
  },
  footer: {
    paddingHorizontal: Spacing.baseSpacing,
    paddingBottom: Spacing.baseSpacing,
  },
  actionButton: {
    marginBottom: Spacing.baseSpacing,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: Spacing.smallSpacing,
  },
  loginLinkText: {
    fontSize: Typography.bodyMedium.fontSize,
    color: Colors.neutral,
  },
  loginLinkBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
