/** Piezas compartidas por las pantallas de acceso. */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { Icon } from '@/components/ui/Icon';
import { haptics } from '@/lib/haptics';
import { palette, screenPadding, useAppTheme } from '@/theme';

import { passwordStrength } from './validation';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
};

/** Estructura de las pantallas de acceso: símbolo, título, formulario y pie. */
export function AuthLayout({ title, subtitle, children, footer, onBack }: AuthLayoutProps) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xxl,
            paddingHorizontal: screenPadding,
            gap: spacing.xxl,
            flexGrow: 1,
          }}
        >
          <View style={styles.topRow}>
            {onBack ? (
              <IconButton icon="chevron.left" variant="plain" accessibilityLabel="Volver" onPress={onBack} />
            ) : (
              <View style={styles.spacer} />
            )}
          </View>
          <View style={{ gap: spacing.md }}>
            <View style={[styles.mark, { backgroundColor: palette.forest }]}>
              <LogoMark size={30} />
            </View>
            <AppText variant="largeTitle" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="callout" color="textSecondary">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <View style={{ gap: spacing.lg }}>{children}</View>
          {footer ? <View style={[styles.footer, { gap: spacing.md }]}>{footer}</View> : null}
          <View style={styles.spacer} />
          <AppText variant="caption" color="textTertiary" align="center">
            LUJITOS · Tu dinero, bajo control
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Barra de 4 segmentos que muestra qué tan segura es la contraseña. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { colors, spacing } = useAppTheme();
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const color = score <= 1 ? colors.negativeGraphic : score === 2 ? colors.warningGraphic : colors.positiveGraphic;
  return (
    <View style={{ gap: spacing.xs }} accessible accessibilityLabel={`Seguridad de la contraseña: ${label}`}>
      <View style={styles.meter}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.meterBar, { backgroundColor: step <= Math.max(score, 1) ? color : colors.surfaceMuted }]}
          />
        ))}
      </View>
      <AppText variant="footnote" color={score <= 1 ? 'negative' : score === 2 ? 'warning' : 'positive'}>
        Contraseña {label.toLowerCase()}
      </AppText>
    </View>
  );
}

type CheckboxProps = { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; error?: string };

/** Casilla de verificación con texto (aceptación de términos). */
export function Checkbox({ checked, onChange, children, error }: CheckboxProps) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => {
          haptics.selection();
          onChange(!checked);
        }}
        style={styles.checkRow}
        hitSlop={6}
      >
        <View
          style={[
            styles.checkBox,
            {
              borderRadius: radius.xs,
              borderColor: error ? colors.negative : checked ? colors.primary : colors.borderStrong,
              backgroundColor: checked ? colors.primary : colors.surface,
            },
          ]}
        >
          {checked ? <Icon name="checkmark" size={13} color={colors.onPrimary} weight="bold" /> : null}
        </View>
        <View style={styles.flex}>{children}</View>
      </Pressable>
      {error ? (
        <AppText variant="footnote" color="negative">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** Mensaje de error general de un formulario. */
export function FormMessage({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'success' }) {
  const { colors, radius } = useAppTheme();
  if (!message) return null;
  const isError = tone === 'error';
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[
        styles.message,
        { backgroundColor: isError ? colors.negativeSoft : colors.positiveSoft, borderRadius: radius.sm },
      ]}
    >
      <Icon
        name={isError ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'}
        size={15}
        color={isError ? colors.negative : colors.positive}
      />
      <AppText variant="footnote" color={isError ? 'negative' : 'positive'} style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  mark: { width: 52, height: 52, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center' },
  meter: { flexDirection: 'row', gap: 6 },
  meterBar: { flex: 1, height: 5, borderRadius: 3 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkBox: { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  flex: { flex: 1 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
});
