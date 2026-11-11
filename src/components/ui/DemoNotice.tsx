import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** Aviso discreto de que la pantalla usa datos ficticios o es un prototipo. */
export function DemoNotice({ text = 'Datos de demostración. Nada de esto es información real.' }: { text?: string }) {
  const { colors, radius } = useAppTheme();
  return (
    <View
      accessibilityRole="text"
      style={[styles.box, { backgroundColor: colors.accentSoft, borderRadius: radius.sm }]}
    >
      <Icon name="info.circle" size={15} color={colors.accentText} />
      <AppText variant="footnote" color="accentText" style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderCurve: 'continuous' },
  text: { flex: 1 },
});
