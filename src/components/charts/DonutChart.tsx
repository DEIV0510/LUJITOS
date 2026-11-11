import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { haptics } from '@/lib/haptics';
import { formatMoney, formatPercent, type Money } from '@/lib/money';
import { useAppTheme } from '@/theme';

import { arcPath } from './chartUtils';

export type DonutSlice = { key: string; label: string; value: Money; color: string };

type Props = { data: DonutSlice[]; size?: number; thickness?: number; centerCaption: string };

const GAP = 0.03;

/** Dona de distribución. Tocar una categoría la resalta y muestra su valor en el centro. */
export function DonutChart({ data, size = 172, thickness = 22, centerCaption }: Props) {
  const { colors, spacing, radius: radii } = useAppTheme();
  const { hidden } = usePrivacy();
  const [selected, setSelected] = useState<string | null>(null);

  const total = data.reduce((acc, slice) => acc + slice.value, 0);
  const radius = (size - thickness) / 2 - 3;
  const center = size / 2;
  const active = data.find((slice) => slice.key === selected) ?? null;

  let cursor = 0;
  const arcs = data.map((slice) => {
    const sweep = total > 0 ? (slice.value / total) * Math.PI * 2 : 0;
    const start = cursor + (data.length > 1 ? GAP / 2 : 0);
    const end = cursor + sweep - (data.length > 1 ? GAP / 2 : 0);
    cursor += sweep;
    return { slice, start, end };
  });

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.chartWrap}>
        <Svg width={size} height={size}>
          {data.length === 1 && data[0] ? (
            <Circle cx={center} cy={center} r={radius} stroke={data[0].color} strokeWidth={thickness} fill="none" />
          ) : (
            arcs.map(({ slice, start, end }) =>
              end > start ? (
                <Path
                  key={slice.key}
                  d={arcPath(center, center, radius, start, end)}
                  stroke={slice.color}
                  strokeWidth={selected === slice.key ? thickness + 6 : thickness}
                  opacity={selected && selected !== slice.key ? 0.35 : 1}
                  fill="none"
                />
              ) : null,
            )
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <AppText variant="caption" color="textSecondary" align="center" numberOfLines={1} style={{ maxWidth: size - thickness * 2 - 16 }}>
            {active ? active.label : centerCaption}
          </AppText>
          <AppText
            variant="amountM"
            align="center"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ maxWidth: size - thickness * 2 - 12 }}
          >
            {formatMoney(active ? active.value : total, { hidden })}
          </AppText>
          {active && total > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {formatPercent((active.value / total) * 100)}
            </AppText>
          ) : null}
        </View>
      </View>

      <View>
        {data.map((slice) => {
          const isSelected = slice.key === selected;
          return (
            <Pressable
              key={slice.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${slice.label}: ${formatMoney(slice.value, { hidden })}, ${formatPercent(
                total > 0 ? (slice.value / total) * 100 : 0,
              )}`}
              onPress={() => {
                haptics.selection();
                setSelected(isSelected ? null : slice.key);
              }}
              style={[
                styles.legendRow,
                { borderRadius: radii.sm, paddingHorizontal: spacing.sm },
                isSelected && { backgroundColor: colors.primarySoft },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: slice.color }]} />
              <AppText variant="callout" numberOfLines={2} style={styles.flex}>
                {slice.label}
              </AppText>
              <AppText variant="footnote" color="textSecondary" style={styles.percent}>
                {formatPercent(total > 0 ? (slice.value / total) * 100 : 0, { digits: 0 })}
              </AppText>
              <AppText variant="amountS" align="right" style={styles.amount} numberOfLines={1}>
                {formatMoney(slice.value, { hidden })}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  flex: { flex: 1, minWidth: 0 },
  percent: { width: 44, textAlign: 'right' },
  amount: { minWidth: 92 },
});
