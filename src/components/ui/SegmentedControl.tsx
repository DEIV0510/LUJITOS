import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** 'surface' sobre fondo de pantalla · 'brand' sobre la tarjeta verde. */
  tone?: 'surface' | 'brand';
};

const PADDING = 3;

/** Selector de opciones. El indicador cambia al instante, sin animación (decisión del usuario). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
  tone = 'surface',
}: Props<T>) {
  const { colors, radius, shadows, scheme } = useAppTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const track = tone === 'brand' ? colors.brandRaised : colors.surfaceMuted;
  const indicator = tone === 'brand' ? colors.onBrand : scheme === 'dark' ? colors.borderStrong : colors.surface;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: track, borderRadius: radius.md, borderCurve: 'continuous' }, style]}
    >
      {segment > 0 ? (
        <View
          style={[
            styles.indicator,
            {
              width: segment,
              backgroundColor: indicator,
              borderRadius: radius.md - PADDING,
              borderCurve: 'continuous',
            },
            tone === 'surface' && scheme === 'light' ? shadows.card : null,
            { transform: [{ translateX: index * segment }] },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        const textColor =
          tone === 'brand' ? (selected ? 'text' : 'onBrandSecondary') : selected ? 'text' : 'textSecondary';
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(option.value);
              }
            }}
            style={styles.segment}
          >
            <AppText
              variant={options.length >= 5 ? 'label' : 'subhead'}
              color={textColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[selected && styles.selectedLabel, tone === 'brand' && selected && { color: colors.brand }]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: PADDING, minHeight: 38 },
  indicator: { position: 'absolute', top: PADDING, bottom: PADDING, left: PADDING },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, minHeight: 32 },
  selectedLabel: { fontFamily: 'Inter_600SemiBold' },
});
