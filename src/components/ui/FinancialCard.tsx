import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props = ViewProps & {
  style?: StyleProp<ViewStyle>;
  /** 'surface' tarjeta blanca · 'muted' superficie secundaria · 'brand' verde bosque. */
  tone?: 'surface' | 'muted' | 'brand';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Superficie base de todas las tarjetas de LUJITOS. */
export function FinancialCard({ tone = 'surface', padding, style, onPress, children, ...rest }: Props) {
  const { colors, radius, spacing, shadows, scheme } = useAppTheme();
  const background =
    tone === 'brand' ? colors.brand : tone === 'muted' ? colors.surfaceMuted : colors.surface;
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: background,
      borderRadius: radius.lg,
      borderCurve: 'continuous',
      padding: padding ?? spacing.lg,
    },
    tone === 'surface' && {
      borderWidth: scheme === 'dark' ? 1 : 0,
      borderColor: colors.border,
      ...shadows.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <PressableScale accessibilityRole="button" onPress={onPress} style={cardStyle} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}
