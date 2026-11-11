import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

import { useFinanceData } from './FinanceDataProvider';

/** Aviso visible en modo demostración, con salida directa a los datos reales. */
export function DemoModeBanner() {
  const { colors, radius } = useAppTheme();
  const { mode, setMode } = useFinanceData();
  if (mode !== 'demo') return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Estás viendo datos de demostración. Volver a mis datos"
      onPress={() => {
        haptics.selection();
        setMode('live');
      }}
      style={({ pressed }) => [
        styles.box,
        { backgroundColor: colors.accentSoft, borderRadius: radius.sm },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name="sparkles" size={15} color={colors.accentText} />
      <AppText variant="footnote" color="accentText" style={styles.text}>
        Modo demostración: datos ficticios.
      </AppText>
      <AppText variant="footnote" color="accentText" style={styles.link}>
        Volver a mis datos
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  text: { flex: 1 },
  link: { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
});
