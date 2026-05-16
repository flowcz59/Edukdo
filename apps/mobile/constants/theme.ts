import { StyleSheet } from 'react-native';

export const Colors = {
  // Couleurs primaires
  gold: '#F5C842',
  teal: '#2DD4BF',
  purple: '#A78BFA',

  // Fonds
  darkBg: '#0A0F1E',
  cardBg: '#111827',
  cardBorder: '#1F2D45',

  // Textes
  textPrimary: '#E8EDF5',
  textSecondary: '#8899BB',
  textMuted: '#3A4A6B',

  // Statuts
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const theme = { Colors, Spacing, BorderRadius, Typography } as const;

type Theme = typeof theme;

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: Theme) => T,
): T {
  return StyleSheet.create(factory(theme));
}
