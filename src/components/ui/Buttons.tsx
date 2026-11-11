import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { palette, useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'regular' | 'large';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** 'inverse' para fondos verde bosque (bienvenida). */
  tone?: 'default' | 'inverse';
};

/** Acción principal de cada pantalla. */
export function PrimaryButton({ label, onPress, icon, disabled, loading, size = 'regular', style, accessibilityHint, tone = 'default' }: ButtonProps) {
  const { colors, radius, spacing } = useAppTheme();
  const background = tone === 'inverse' ? palette.ivory : colors.primary;
  const foreground = tone === 'inverse' ? palette.forest : colors.onPrimary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={[
        styles.base,
        {
          backgroundColor: background,
          borderRadius: radius.md,
          minHeight: size === 'large' ? 56 : 48,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={foreground} weight="semibold" /> : null}
          <AppText variant="button" numberOfLines={1} style={{ color: foreground }}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

/** Acción secundaria: fondo suave, mismo tamaño táctil. */
export function SecondaryButton({ label, onPress, icon, disabled, size = 'regular', style, accessibilityHint, tone = 'default' }: ButtonProps) {
  const { colors, radius, spacing } = useAppTheme();
  const inverse = tone === 'inverse';
  const foreground = inverse ? palette.ivory : colors.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.base,
        {
          backgroundColor: inverse ? 'transparent' : colors.primarySoft,
          borderWidth: inverse ? 1 : 0,
          borderColor: inverse ? 'rgba(244,241,232,0.45)' : 'transparent',
          borderRadius: radius.md,
          minHeight: size === 'large' ? 56 : 48,
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={17} color={foreground} weight="semibold" /> : null}
        <AppText variant="button" numberOfLines={1} style={{ color: foreground }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'onBrand';
  size?: number;
  children?: React.ReactNode;
};

/** Botón circular de 44 pt (área táctil mínima de Apple). */
export function IconButton({ icon, onPress, accessibilityLabel, variant = 'filled', size = 44, children }: IconButtonProps) {
  const { colors } = useAppTheme();
  const background =
    variant === 'filled' ? colors.surface : variant === 'onBrand' ? colors.brandLine : 'transparent';
  const tint = variant === 'onBrand' ? colors.onBrand : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      scaleTo={0.92}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderWidth: variant === 'filled' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <Icon name={icon} size={size * 0.42} color={tint} />
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
