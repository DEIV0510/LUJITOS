import { forwardRef, useEffect, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { formatAmountInput, parseAmountInput, type Money } from '@/lib/money';
import { useAppTheme } from '@/theme';

type Props = {
  value: Money;
  onChange: (value: Money) => void;
  label: string;
  /** 'hero' monto grande centrado (registro de movimientos) · 'field' campo de formulario. */
  variant?: 'hero' | 'field';
  autoFocus?: boolean;
  error?: string;
  tint?: 'positive' | 'negative' | 'text';
};

/**
 * Campo de monto en pesos con teclado numérico. Agrupa los miles mientras se
 * escribe ($ 1.250.000) y entrega el valor en centavos.
 *
 * El monto se dibuja como texto (centrado y con tamaño adaptable) y un campo
 * invisible encima recibe el teclado: así el diseño no depende de cómo mida
 * cada plataforma un TextInput.
 */
export const MoneyInput = forwardRef<ComponentRef<typeof TextInput>, Props>(function MoneyInput(
  { value, onChange, label, variant = 'field', autoFocus, error, tint = 'text' },
  ref,
) {
  const { colors, typography, radius, spacing } = useAppTheme();
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const hero = variant === 'hero';
  const color = tint === 'positive' ? colors.positive : tint === 'negative' ? colors.negative : colors.text;
  const formatted = formatAmountInput(value);
  const empty = value === 0;
  const textStyle = hero
    ? { ...typography.amountXL, fontSize: 46, lineHeight: 54, letterSpacing: -1.2 }
    : typography.amountL;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color="textSecondary" align={hero ? 'center' : 'left'}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          hero
            ? styles.heroBox
            : {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: error ? colors.negative : focused ? colors.primary : colors.border,
                paddingHorizontal: spacing.lg,
                minHeight: 56,
                justifyContent: 'flex-start',
              },
        ]}
      >
        <View style={[styles.display, hero && styles.displayHero]} pointerEvents="none">
          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[textStyle, styles.amount, { color: empty ? colors.textTertiary : color }]}
          >
            {`$ ${empty ? '0' : formatted}`}
          </AppText>
          {focused ? <Caret height={hero ? 40 : 26} color={colors.primary} /> : null}
        </View>
        <TextInput
          ref={ref}
          value={empty ? '' : formatted}
          onChangeText={(text) => onChange(parseAmountInput(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus={autoFocus}
          maxLength={15}
          caretHidden
          contextMenuHidden
          accessibilityLabel={label}
          accessibilityHint="Escribe el valor en pesos"
          style={styles.hiddenInput}
        />
      </View>
      {error ? (
        <AppText variant="footnote" color="negative" align={hero ? 'center' : 'left'}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

function Caret({ height, color }: { height: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.caret, { height, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  heroBox: { justifyContent: 'center', minHeight: 64 },
  display: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '100%' },
  displayHero: { justifyContent: 'center' },
  amount: { flexShrink: 1 },
  caret: { width: 2, borderRadius: 1, marginLeft: 3 },
  // iOS ignora los toques en vistas con opacidad menor a 0,01: por eso 0,02.
  hiddenInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.02, color: 'transparent' },
});
