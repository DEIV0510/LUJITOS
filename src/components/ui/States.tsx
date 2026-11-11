import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { Icon } from './Icon';

type EmptyProps = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Estado vacío: explica qué falta y qué hacer. */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyProps) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={[styles.empty, { paddingVertical: spacing.xxxl, gap: spacing.md }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      <AppText variant="callout" color="textSecondary" align="center" style={styles.emptyMessage}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <SecondaryButton label={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

/** Esqueleto de carga para listas y tarjetas (listo para los datos reales de la Fase 3). */
export function LoadingState({ rows = 3, label = 'Cargando' }: { rows?: number; label?: string }) {
  const { colors, radius, spacing } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) {
      pulse.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
    }
  }, [pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: spacing.md }}>
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View key={index} style={[styles.skeletonRow, pulseStyle]}>
          <View style={[styles.skeletonCircle, { backgroundColor: colors.skeleton }]} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={[styles.skeletonLine, { width: '62%', backgroundColor: colors.skeleton, borderRadius: radius.xs }]} />
            <View style={[styles.skeletonLine, { width: '38%', height: 10, backgroundColor: colors.skeleton, borderRadius: radius.xs }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: 16 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyMessage: { maxWidth: 300 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonCircle: { width: 40, height: 40, borderRadius: 20 },
  skeletonLine: { height: 13 },
});
