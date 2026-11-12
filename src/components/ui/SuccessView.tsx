import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  title: string;
  message: string;
  /** Milisegundos antes de cerrar la hoja. null = no cierra sola. */
  autoCloseMs?: number | null;
  onDone?: () => void;
};

/** Confirmación visual después de guardar (cuenta, movimiento, ajuste, categoría). */
export function SuccessView({ title, message, autoCloseMs = 1200, onDone }: Props) {
  const { colors, spacing } = useAppTheme();

  useEffect(() => {
    if (autoCloseMs === null) return;
    const timer = setTimeout(() => (onDone ? onDone() : router.back()), autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onDone]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
      <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.check, { backgroundColor: colors.positiveSoft }]}>
        <Icon name="checkmark" size={34} color={colors.positive} weight="bold" />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="title" align="center">
          {title}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center" style={styles.text}>
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  check: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  text: { maxWidth: 300 },
});
