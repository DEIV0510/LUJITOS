import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/auth';
import { palette, screenPadding } from '@/theme';
import type { IconName } from '@/types/finance';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'creditcard.fill', text: 'Todas tus cuentas, billeteras y efectivo en un solo lugar.' },
  { icon: 'chart.bar.fill', text: 'Ingresos, gastos y presupuestos claros, mes a mes.' },
  { icon: 'lock.fill', text: 'Tus datos protegidos. Nunca te pedimos la clave de tu banco.' },
];

/** Bienvenida: primera pantalla sin sesión. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  // «Tu sesión terminó…» cuando la sesión venció sin que el usuario la cerrara.
  const { notice } = useAuth();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.watermark} pointerEvents="none">
        <LogoMark size={340} color="rgba(244,241,232,0.04)" coinColor="rgba(198,166,106,0.10)" />
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
        <LogoMark size={64} />
        <AppText style={styles.wordmark} accessibilityRole="header">
          LUJITOS
        </AppText>
        <View style={styles.rule} />
        <AppText style={styles.tagline}>TU DINERO, BAJO CONTROL</AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.icon} style={styles.point}>
            <View style={styles.pointIcon}>
              <Icon name={point.icon} size={16} color={palette.gold} />
            </View>
            <AppText variant="callout" style={styles.pointText}>
              {point.text}
            </AppText>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.actions}>
        {notice ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Icon name="info.circle.fill" size={16} color={palette.gold} />
            <AppText variant="footnote" style={styles.noticeText}>
              {notice}
            </AppText>
          </View>
        ) : null}
        <PrimaryButton label="Crear cuenta" size="large" tone="inverse" onPress={() => router.push('/sign-up')} />
        <SecondaryButton label="Iniciar sesión" size="large" tone="inverse" onPress={() => router.push('/sign-in')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.forest, paddingHorizontal: screenPadding, justifyContent: 'space-between' },
  watermark: { position: 'absolute', right: -120, top: 120 },
  brand: { alignItems: 'flex-start', marginTop: 24 },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 8,
    color: palette.ivory,
    marginTop: 28,
  },
  rule: { width: 32, height: 1.5, backgroundColor: palette.gold, marginVertical: 14 },
  tagline: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 2.6, color: palette.sage },
  points: { gap: 18 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,241,232,0.08)',
  },
  pointText: { flex: 1, color: 'rgba(244,241,232,0.86)' },
  actions: { gap: 12 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(198,166,106,0.35)',
    backgroundColor: 'rgba(244,241,232,0.06)',
  },
  noticeText: { flex: 1, color: palette.ivory },
});
