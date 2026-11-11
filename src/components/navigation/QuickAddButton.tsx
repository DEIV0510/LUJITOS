import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptics } from '@/lib/haptics';
import { screenPadding, useAppTheme } from '@/theme';

import { TAB_BAR_HEIGHT } from './BottomNavigation';

const SIZE = 58;

/** Botón flotante para registrar un ingreso, gasto o transferencia desde cualquier pestaña. */
export function QuickAddButton() {
  const { colors, shadows } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 14;

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(16)}
      exiting={ZoomOut.duration(140)}
      style={[styles.wrap, { bottom, right: insets.right + screenPadding }]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Agregar movimiento"
        accessibilityHint="Registra un ingreso, un gasto o una transferencia"
        scaleTo={0.92}
        onPress={() => {
          haptics.medium();
          router.push('/transaction/new');
        }}
        style={[styles.button, { backgroundColor: colors.primary }, shadows.floating]}
      >
        <Icon name="plus" size={24} color={colors.onPrimary} weight="semibold" />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
