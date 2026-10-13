// Generated Design System Tokens for Rota Mobile Application
// Direct implementation of design-tokens.tokens (2).json and .agent/rules/design-system-rule.md

export const Colors = {
  // Primary semantic roles
  primary: '#2f6b5f',
  onPrimary: '#ffffff',
  primaryContainer: '#9ee6d9',
  onPrimaryContainer: '#00201a',

  // Secondary semantic roles
  secondary: '#4f8f83',
  onSecondary: '#ffffff',
  secondaryContainer: '#b9ebe0',
  onSecondaryContainer: '#0a2923',

  // Tertiary semantic roles
  tertiary: '#d99a3d',
  onTertiary: '#ffffff',
  tertiaryContainer: '#ffddb4',
  onTertiaryContainer: '#2a1700',

  // Neutral semantic roles
  neutral: '#566062',
  onNeutral: '#ffffff',
  neutralContainer: '#dce5e1',
  onNeutralContainer: '#131d1e',
  neutralVariant: '#526063',
  onNeutralVariant: '#ffffff',
  neutralVariantContainer: '#d5e4e7',
  onNeutralVariantContainer: '#0f1d1f',

  // Surface and container hierarchy
  surface: '#f6fbf8',
  onSurface: '#191d1c',
  surfaceVariant: '#dce5e1',
  onSurfaceVariant: '#404947',
  surfaceContainer: '#eaf0ed',
  surfaceContainerHigh: '#e4eae7',
  surfaceContainerHighest: '#dee4e1',
  surfaceContainerLow: '#f0f6f3',
  surfaceContainerLowest: '#ffffff',
  inverseSurface: '#2d3130',
  inverseOnSurface: '#eff1ef',

  // Status & Feedback semantic roles
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',

  success: '#126d36',
  onSuccess: '#ffffff',
  successContainer: '#a2f6b0',
  onSuccessContainer: '#00210b',

  warning: '#7d5700',
  onWarning: '#ffffff',
  warningContainer: '#ffdf9e',
  onWarningContainer: '#261900',

  info: '#00658e',
  onInfo: '#ffffff',
  infoContainer: '#c6e7ff',
  onInfoContainer: '#001e2e',
} as const;

export const Typography = {
  displayLarge: {
    fontSize: 57,
    lineHeight: 64,
    fontWeight: '400' as const,
  },
  displayMedium: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: '400' as const,
  },
  displaySmall: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '400' as const,
  },
  headlineLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600' as const,
  },
  headlineMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
  },
  headlineSmall: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
  },
  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  titleSmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
} as const;

export const Spacing = {
  smallSpacing: 8,
  mediumSpacing: 12,
  baseSpacing: 16,
  largeSpacing: 24,
  xLargeSpacing: 32,
} as const;

export const Effects = {
  softShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  mediumShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  hardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
