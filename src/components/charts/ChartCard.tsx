import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { useAppTheme } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  control?: ReactNode;
  children: ReactNode;
};

/** Contenedor de gráfico: título, control de periodo opcional y el gráfico. */
export function ChartCard({ title, subtitle, right, control, children }: Props) {
  const { spacing } = useAppTheme();
  return (
    <FinancialCard padding={spacing.lg}>
      <View style={styles.header}>
        <View style={styles.texts}>
          <AppText variant="headline" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="footnote" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
      {control ? <View style={{ marginTop: spacing.md }}>{control}</View> : null}
      <View style={{ marginTop: spacing.lg }}>{children}</View>
    </FinancialCard>
  );
}

type LegendItem = { label: string; color: string; value: string };

/** Lectura del gráfico: muestra los totales o el punto que el usuario toca. */
export function ChartReadout({ caption, items }: { caption: string; items: LegendItem[] }) {
  const { spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.md }} accessibilityLiveRegion="polite">
      <AppText variant="caption" color="textSecondary">
        {caption}
      </AppText>
      <View style={styles.items}>
        {items.map((item) => (
          <View key={item.label} style={styles.item} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <AppText variant="footnote" color="textSecondary">
              {item.label}
            </AppText>
            <AppText variant="amountS">{item.value}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  texts: { flex: 1, gap: 2 },
  items: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
