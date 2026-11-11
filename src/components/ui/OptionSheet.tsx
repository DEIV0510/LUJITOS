import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Hoja inferior para elegir una opción (entidad, tipo, cuenta, categoría, filtros).
 * Sin animaciones: aparece y se cierra al instante (decisión del usuario).
 */
export function OptionSheet({ visible, title, onClose, children }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        {visible ? (
          <View
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
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            </View>
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
          </View>
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
