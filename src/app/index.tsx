/**
 * Pantalla de prueba de la Fase 1.
 * Solo comprueba que el entorno funciona en el iPhone: Expo Go, rutas,
 * animaciones, modo claro/oscuro, áreas seguras y formato regional.
 * No muestra datos financieros. Se reemplaza por el Inicio en la Fase 4.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP } from '@/constants/app';
import { useAppTheme, type AppTheme } from '@/theme';

type CheckRow = { label: string; value: string };

const UNAVAILABLE = 'No disponible';

function attempt(read: () => string | undefined): string {
  try {
    return read() ?? UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

function runtimeName(): string {
  switch (Constants.executionEnvironment) {
    case ExecutionEnvironment.StoreClient:
      return 'Expo Go';
    case ExecutionEnvironment.Standalone:
      return 'Compilación propia';
    default:
      return 'Compilación de desarrollo';
  }
}

function buildRows(theme: AppTheme, now: Date): CheckRow[] {
  return [
    { label: 'Versión', value: `${APP.name} ${Constants.expoConfig?.version ?? ''}`.trim() },
    { label: 'Expo SDK', value: Constants.expoConfig?.sdkVersion ?? UNAVAILABLE },
    { label: 'Se ejecuta en', value: runtimeName() },
    { label: 'Sistema', value: Platform.OS === 'ios' ? `iOS ${Platform.Version}` : Platform.OS },
    { label: 'Apariencia', value: theme.scheme === 'dark' ? 'Oscura' : 'Clara' },
    {
      label: 'Zona del iPhone',
      value: attempt(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    },
    {
      label: 'Hora en Bogotá',
      value: attempt(() =>
        new Intl.DateTimeFormat(APP.locale, {
          timeZone: APP.timeZone,
          hour: 'numeric',
          minute: '2-digit',
        }).format(now),
      ),
    },
    {
      label: 'Formato de moneda',
      value: attempt(() =>
        new Intl.NumberFormat(APP.locale, {
          style: 'currency',
          currency: APP.currency,
          maximumFractionDigits: 0,
        }).format(1234567),
      ),
    },
  ];
}

export default function SetupCheckScreen() {
  const theme = useAppTheme();
  const { spacing } = theme;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [now] = useState(() => new Date());

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const rows = buildRows(theme, now);
  const styles = createStyles(theme);
  const enter = (order: number) =>
    FadeInDown.delay(order * 110)
      .duration(480)
      .easing(Easing.out(Easing.cubic));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingLeft: insets.left + spacing.xl,
          paddingRight: insets.right + spacing.xl,
        },
      ]}
    >
      <Animated.View entering={enter(0)}>
        <Text style={styles.wordmark} accessibilityRole="header">
          {APP.name}
        </Text>
        <Text style={styles.tagline}>{APP.tagline}</Text>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.card}>
        <View
          style={styles.track}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={[styles.fill, progressStyle]} />
        </View>
        <Text style={styles.eyebrow}>FASE 1 · ENTORNO</Text>
        <Text style={styles.title}>LUJITOS ya abre en tu iPhone</Text>
        <Text style={styles.body}>
          Esta pantalla solo comprueba la instalación. Todavía no hay cuentas, saldos ni
          movimientos.
        </Text>
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.card}>
        <Text style={styles.eyebrowMuted}>DIAGNÓSTICO</Text>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[styles.row, index > 0 && styles.rowDivider]}
            accessible
            accessibilityLabel={`${row.label}: ${row.value}`}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Text style={styles.footnote}>Siguiente: Fase 2 · Identidad visual y pantallas</Text>
      </Animated.View>
    </ScrollView>
  );
}

function createStyles({ colors, spacing, radius, typography }: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      gap: spacing.lg,
    },
    wordmark: {
      ...typography.wordmark,
      color: colors.text,
    },
    tagline: {
      ...typography.callout,
      color: colors.textMuted,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      overflow: 'hidden',
    },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accentTrack,
      marginBottom: spacing.xl,
      overflow: 'hidden',
    },
    fill: {
      flex: 1,
      borderRadius: 2,
      backgroundColor: colors.accent,
      transformOrigin: 'left',
    },
    eyebrow: {
      ...typography.label,
      color: colors.accent,
    },
    eyebrowMuted: {
      ...typography.label,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.title,
      color: colors.text,
      marginTop: spacing.sm,
    },
    body: {
      ...typography.body,
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      minHeight: 48,
      paddingVertical: spacing.md,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowLabel: {
      ...typography.callout,
      color: colors.textMuted,
      flexShrink: 1,
    },
    rowValue: {
      ...typography.callout,
      color: colors.text,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
      flexShrink: 1,
    },
    footnote: {
      ...typography.label,
      fontWeight: '500',
      letterSpacing: 0,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
}
