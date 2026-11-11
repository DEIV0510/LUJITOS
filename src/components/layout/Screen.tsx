import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, useAppTheme } from '@/theme';

/** Espacio que deja libre el botón flotante «Agregar» al final de cada lista. */
export const FAB_CLEARANCE = 84;

type Props = {
  children: ReactNode;
  /** Encabezado fijo (pantallas secundarias). Si existe, el contenido no suma el área segura superior. */
  header?: ReactNode;
  /** Pantallas con botón flotante: deja espacio para no tapar el último elemento. */
  withFab?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pantallas dentro de las pestañas: la barra inferior ya cubre el área segura de abajo. */
  inTabs?: boolean;
};

/** Contenedor con desplazamiento vertical, márgenes laterales y áreas seguras del iPhone. */
export function Screen({ children, header, withFab, contentStyle, inTabs }: Props) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottom = (inTabs ? 0 : insets.bottom) + spacing.xxxl + (withFab ? FAB_CLEARANCE : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          {
            paddingTop: header ? spacing.sm : insets.top + spacing.sm,
            paddingBottom: bottom,
            paddingLeft: insets.left + screenPadding,
            paddingRight: insets.right + screenPadding,
            gap: spacing.xxl,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
