import type { StyleProp, TextStyle } from 'react-native';

import { AppText, type TextColor } from '@/components/ui/AppText';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatMoney, type Money, type SignMode } from '@/lib/money';
import type { TypographyVariant } from '@/theme';

type Props = {
  amount: Money;
  variant?: TypographyVariant;
  sign?: SignMode;
  /** 'auto' pinta en verde/rojo según el signo. */
  color?: TextColor | 'auto';
  /** Reduce el tamaño si no cabe, en vez de cortar el número. */
  fit?: boolean;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
};

/** Monto en formato colombiano ($ 1.250.000). Respeta la opción de ocultar valores. */
export function AmountText({ amount, variant = 'amount', sign = 'auto', color = 'text', fit, align, style }: Props) {
  const { hidden } = usePrivacy();
  const resolved: TextColor = color === 'auto' ? (amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'text') : color;
  const text = formatMoney(amount, { sign, hidden });
  return (
    <AppText
      variant={variant}
      color={resolved}
      align={align}
      numberOfLines={1}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.6 : undefined}
      accessibilityLabel={hidden ? 'Valor oculto' : text.replace('−', 'menos ')}
      style={style}
    >
      {text}
    </AppText>
  );
}
