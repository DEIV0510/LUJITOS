/**
 * Selectores visuales sin animación (preferencia del usuario): color, ícono y
 * día del mes. Tocar una opción la marca al instante.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { resolveTone, tones, useAppTheme, type Tone } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { Icon } from './Icon';

export function ToneSwatches({ value, options, onChange }: { value: Tone | null; options: Tone[]; onChange: (tone: Tone) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Color">
      {options.map((tone) => {
        const selected = tone === value;
        return (
          <Pressable
            key={tone}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Color ${tone}`}
            onPress={() => onChange(tone)}
            hitSlop={4}
            style={[styles.swatchRing, { borderColor: selected ? colors.text : 'transparent' }]}
          >
            <View style={[styles.swatch, { backgroundColor: tones[tone] }]}>
              {selected ? <Icon name="checkmark" size={14} color="#FFFFFF" weight="bold" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconGrid({
  value,
  options,
  tone,
  onChange,
  noneLabel,
}: {
  value: IconName | null;
  options: IconName[];
  tone: Tone;
  onChange: (icon: IconName | null) => void;
  /** Opción «sin ícono» (por ejemplo, usar las iniciales de la entidad). */
  noneLabel?: string;
}) {
  const { colors, scheme } = useAppTheme();
  const set = resolveTone(tone, scheme);
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Ícono">
      {noneLabel ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
          accessibilityLabel={noneLabel}
          onPress={() => onChange(null)}
          style={[styles.iconCell, { backgroundColor: set.soft, borderColor: value === null ? colors.text : 'transparent' }]}
        >
          <AppText variant="caption" style={{ color: set.ink, fontFamily: 'Inter_700Bold' }}>
            Aa
          </AppText>
        </Pressable>
      ) : null}
      {options.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={icon}
            onPress={() => onChange(icon)}
            style={[styles.iconCell, { backgroundColor: set.soft, borderColor: selected ? colors.text : 'transparent' }]}
          >
            <Icon name={icon} size={20} color={set.ink} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Días 1–31 (corte y pago de una tarjeta). */
export function DayGrid({ value, onChange }: { value: number | null; onChange: (day: number) => void }) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
        const selected = day === value;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Día ${day}`}
            onPress={() => onChange(day)}
            style={[
              styles.day,
              { borderRadius: radius.sm, backgroundColor: selected ? colors.primary : colors.surfaceMuted },
            ]}
          >
            <AppText variant="subhead" style={{ color: selected ? colors.onPrimary : colors.text }}>
              {day}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchRing: { padding: 3, borderRadius: 22, borderWidth: 2 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  day: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
});
