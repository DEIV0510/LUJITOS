import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { haptics } from '@/lib/haptics';
import { formatCompact, formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';

import { ChartReadout } from './ChartCard';
import { niceMax, roundedTopBar } from './chartUtils';

export type BarSeries = { key: string; label: string; color: string; values: number[] };

type Props = {
  labels: string[];
  details: string[];
  series: BarSeries[];
  height?: number;
  totalsCaption: string;
};

const AXIS = 44;
const LABELS = 22;

/** Barras agrupadas (por ejemplo, ingresos frente a gastos). Tocar una columna muestra sus valores. */
export function BarChart({ labels, details, series, height = 180, totalsCaption }: Props) {
  const { colors, typography } = useAppTheme();
  const { hidden } = usePrivacy();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const count = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const plotWidth = Math.max(width - AXIS, 0);
  const plotHeight = height - LABELS;
  const groupWidth = count > 0 ? plotWidth / count : 0;
  const barWidth = Math.max(Math.min(groupWidth * (series.length > 1 ? 0.28 : 0.5), 16), 4);
  const gap = series.length > 1 ? Math.min(4, groupWidth * 0.06) : 0;
  const y = (value: number) => plotHeight - (value / max) * (plotHeight - 6);

  const readout =
    selected === null
      ? { caption: totalsCaption, values: series.map((s) => s.values.reduce((a, b) => a + b, 0)) }
      : { caption: details[selected] ?? '', values: series.map((s) => s.values[selected] ?? 0) };

  return (
    <View>
      <ChartReadout
        caption={readout.caption}
        items={series.map((s, index) => ({
          label: s.label,
          color: s.color,
          value: formatMoney(readout.values[index] ?? 0, { hidden }),
        }))}
      />
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Animated.View entering={FadeIn.duration(260)} key={`${labels.join()}-${series.length}`}>
            <Svg width={width} height={height}>
              {[0, 0.5, 1].map((step) => (
                <Line
                  key={step}
                  x1={AXIS}
                  x2={width}
                  y1={y(max * step)}
                  y2={y(max * step)}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                  strokeDasharray={step === 0 ? undefined : '3 4'}
                />
              ))}
              {labels.map((_, index) => {
                const total = series.length * barWidth + (series.length - 1) * gap;
                const start = AXIS + index * groupWidth + (groupWidth - total) / 2;
                const dimmed = selected !== null && selected !== index;
                return series.map((s, seriesIndex) => {
                  const value = s.values[index] ?? 0;
                  const top = y(value);
                  return (
                    <Path
                      key={`${s.key}-${index}`}
                      d={roundedTopBar(start + seriesIndex * (barWidth + gap), top, barWidth, plotHeight - top, 4)}
                      fill={s.color}
                      opacity={dimmed ? 0.3 : 1}
                    />
                  );
                });
              })}
            </Svg>
          </Animated.View>
        ) : null}

        {[0, 0.5, 1].map((step) => (
          <AppText
            key={step}
            variant="caption"
            color="textTertiary"
            style={[styles.axisLabel, { top: y(max * step) - 8 }]}
          >
            {hidden ? '•••' : formatCompact(max * step)}
          </AppText>
        ))}

        <View style={[styles.labels, { left: AXIS, top: plotHeight + 4 }]}>
          {labels.map((label, index) => (
            <AppText
              key={`${label}-${index}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                typography.caption,
                styles.label,
                { width: groupWidth, color: selected === index ? colors.text : colors.textTertiary },
              ]}
            >
              {label}
            </AppText>
          ))}
        </View>

        <View style={[styles.hitArea, { left: AXIS, height: plotHeight }]}>
          {labels.map((label, index) => (
            <Pressable
              key={`hit-${label}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`${details[index] ?? label}: ${series
                .map((s) => `${s.label} ${formatMoney(s.values[index] ?? 0, { hidden })}`)
                .join(', ')}`}
              onPress={() => {
                haptics.selection();
                setSelected((current) => (current === index ? null : index));
              }}
              style={{ width: groupWidth, height: '100%' }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: { position: 'absolute', left: 0, width: AXIS - 8, textAlign: 'right', fontSize: 11 },
  labels: { position: 'absolute', right: 0, flexDirection: 'row' },
  label: { textAlign: 'center', fontSize: 11 },
  hitArea: { position: 'absolute', top: 0, right: 0, flexDirection: 'row' },
});
