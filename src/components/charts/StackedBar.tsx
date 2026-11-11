import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatMoney, formatPercent, type Money } from '@/lib/money';
import { useAppTheme } from '@/theme';

export type StackSegment = { key: string; label: string; value: Money; color: string };

/** Barra horizontal apilada con leyenda (distribución del dinero). */
export function StackedBar({ data }: { data: StackSegment[] }) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const total = data.reduce((acc, segment) => acc + segment.value, 0);

  return (
    <View style={{ gap: spacing.lg }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={data
          .map((segment) => `${segment.label} ${formatPercent(total ? (segment.value / total) * 100 : 0, { digits: 0 })}`)
          .join(', ')}
        style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}
      >
        {data.map((segment, index) => (
          <View
            key={segment.key}
            style={{
              flex: segment.value,
              backgroundColor: segment.color,
              marginLeft: index === 0 ? 0 : 2,
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {data.map((segment) => (
          <View key={segment.key} style={styles.legendItem}>
            <View style={styles.legendHead}>
              <View style={[styles.swatch, { backgroundColor: segment.color }]} />
              <AppText variant="footnote" color="textSecondary" numberOfLines={1} style={styles.flex}>
                {segment.label}
              </AppText>
            </View>
            <AppText variant="amountS" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatMoney(segment.value, { hidden })}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              {formatPercent(total ? (segment.value / total) * 100 : 0, { digits: 0 })}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  legendItem: { width: '50%', paddingRight: 12, gap: 2 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  flex: { flex: 1 },
});
