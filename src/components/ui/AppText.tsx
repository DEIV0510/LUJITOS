import { Text, type TextProps } from 'react-native';

import { useAppTheme, type ThemeColors, type TypographyVariant } from '@/theme';

export type TextColor = keyof Pick<
  ThemeColors,
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'primary'
  | 'onPrimary'
  | 'onBrand'
  | 'onBrandSecondary'
  | 'accentText'
  | 'positive'
  | 'negative'
  | 'warning'
>;

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
};

/** Texto con la escala tipográfica y los colores del tema. */
export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { typography, colors } = useAppTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
