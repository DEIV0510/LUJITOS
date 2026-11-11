import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { haptics } from '@/lib/haptics';
import { formatCompact, formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';

import { ChartReadout } from './ChartCard';
import { monotonePath } from './chartUtils';

export type LineSeries = { key: string; label: string; color: string; values: number[]; area?: boolean };

type Props = {
  labels: string[];
  details: string[];
  series: LineSeries[];
  height?: number;
  /** Texto de la lectura cuando no hay un punto seleccionado (muestra el último valor). */
  currentCaption: string;
};

const AXIS = 44;
const LABELS = 22;
const TOP = 10;

/** Línea suave con área opcional. Deslizar el dedo sobre el gráfico recorre los puntos. */
export function LineChart({ labels, details, series, height = 170, currentCaption }: Props) {
  const { colors, typography } = useAppTheme();
  const { hidden } = usePrivacy();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const count = labels.length;
  const all = series.flatMap((s) => s.values);
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const pad = (rawMax - rawMin) * 0.18 || Math.abs(rawMax) * 0.1 || 1;
  const min = rawMin >= 0 && rawMin - pad < 0 ? 0 : rawMin - pad;
  const max = rawMax + pad;
  const plotWidth = Math.max(width - AXIS - 8, 0);
  const plotHeight = height - LABELS - TOP;
  const x = (index: number) => AXIS + (count > 1 ? (index / (count - 1)) * plotWidth : plotWidth / 2);
  const y = (value: number) => TOP + plotHeight - ((value - min) / (max - min || 1)) * plotHeight;
  const lastIndex = count - 1;
  const active = selected ?? lastIndex;

  const pick = (event: GestureResponderEvent) => {
    if (count === 0 || plotWidth === 0) return;
    const relative = (event.nativeEvent.locationX - AXIS) / plotWidth;
    const index = Math.min(Math.max(Math.round(relative * (count - 1)), 0), lastIndex);
    if (index !== selected) {
      haptics.selection();
      setSelected(index);
    }
  };

  const ticks = [min, (min + max) / 2, max];
  const labelEvery = count > 8 ? 2 : 1;

  return (
    <View>
      <ChartReadout
        caption={selected === null ? currentCaption : details[active] ?? ''}
        items={series.map((s) => ({
          label: s.label,
          color: s.color,
          value: formatMoney(s.values[active] ?? 0, { hidden }),
        }))}
      />
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => true}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${series.map((s) => s.label).join(' y ')}. Último valor: ${series
          .map((s) => formatMoney(s.values[lastIndex] ?? 0, { hidden }))
          .join(', ')}`}
      >
        {width > 0 ? (
          <Animated.View entering={FadeIn.duration(260)} key={labels.join()}>
            <Svg width={width} height={height}>
              <Defs>
                {series.map((s) => (
                  <LinearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={s.color} stopOpacity={0.24} />
                    <Stop offset="1" stopColor={s.color} stopOpacity={0} />
                  </LinearGradient>
                ))}
              </Defs>
              {ticks.map((tick, index) => (
                <Line
                  key={index}
                  x1={AXIS}
                  x2={width}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                  strokeDasharray={index === 0 ? undefined : '3 4'}
                />
              ))}
              {series.map((s) => {
                const points = s.values.map((value, index) => ({ x: x(index), y: y(value) }));
                const line = monotonePath(points);
                const first = points[0];
                const last = points[points.length - 1];
                return (
                  <SvgSeries
                    key={s.key}
                    line={line}
                    area={
                      s.area && first && last
                        ? `${line} L${last.x},${TOP + plotHeight} L${first.x},${TOP + plotHeight} Z`
                        : null
                    }
                    color={s.color}
                    fillId={`fill-${s.key}`}
                  />
                );
              })}
              <Line
                x1={x(active)}
                x2={x(active)}
                y1={TOP}
                y2={TOP + plotHeight}
                stroke={colors.borderStrong}
                strokeWidth={1}
                opacity={selected === null ? 0 : 1}
              />
              {series.map((s) => (
                <Circle
                  key={`dot-${s.key}`}
                  cx={x(active)}
                  cy={y(s.values[active] ?? 0)}
                  r={4.5}
                  fill={colors.surface}
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              ))}
            </Svg>
          </Animated.View>
        ) : null}

        {ticks.map((tick, index) => (
          <AppText
            key={index}
            variant="caption"
            color="textTertiary"
            style={[styles.axisLabel, { top: y(tick) - 8 }]}
          >
            {hidden ? '•••' : formatCompact(tick)}
          </AppText>
        ))}

        {width > 0
          ? labels.map((label, index) =>
              index % labelEvery === 0 || index === lastIndex ? (
                <AppText
                  key={`${label}-${index}`}
                  numberOfLines={1}
                  style={[
                    typography.caption,
                    styles.xLabel,
                    {
                      left: x(index) - 24,
                      top: TOP + plotHeight + 6,
                      color: index === active && selected !== null ? colors.text : colors.textTertiary,
                    },
                  ]}
                >
                  {label}
                </AppText>
              ) : null,
            )
          : null}
      </View>
    </View>
  );
}

function SvgSeries({ line, area, color, fillId }: { line: string; area: string | null; color: string; fillId: string }) {
  return (
    <>
      {area ? <Path d={area} fill={`url(#${fillId})`} /> : null}
      <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const styles = StyleSheet.create({
  axisLabel: { position: 'absolute', left: 0, width: AXIS - 8, textAlign: 'right', fontSize: 11 },
  xLabel: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 11 },
});
