import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Hoja inferior para elegir una opción (cuenta, categoría, fecha, filtros). */
export function OptionSheet({ visible, title, onClose, children }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        {visible ? (
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <Animated.View entering={FadeIn.delay(80)} style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            </Animated.View>
            <AppText variant="headline" align="center" style={{ marginBottom: spacing.md }} accessibilityRole="header">
              {title}
            </AppText>
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%', borderCurve: 'continuous' },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  handle: { width: 38, height: 5, borderRadius: 3 },
  list: { flexGrow: 0 },
});
