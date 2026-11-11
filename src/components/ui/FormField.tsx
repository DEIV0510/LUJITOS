import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { Icon } from './Icon';

type SelectProps = {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  leading?: ReactNode;
  error?: string;
  showDivider?: boolean;
};

/** Campo que abre un selector (cuenta, categoría, fecha). */
export function SelectField({ label, value, placeholder, onPress, leading, error, showDivider }: SelectProps) {
  const { colors } = useAppTheme();
  return (
    <View style={showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      >
        {leading}
        <View style={styles.texts}>
          <AppText variant="caption" color="textSecondary">
            {label}
          </AppText>
          <AppText variant="bodyStrong" color={value ? 'text' : 'textTertiary'} numberOfLines={1}>
            {value ?? placeholder}
          </AppText>
        </View>
        <Icon name="chevron.right" size={13} color={colors.textTertiary} weight="semibold" />
      </Pressable>
      {error ? (
        <AppText variant="footnote" color="negative" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

type TextFieldProps = TextInputProps & { label: string; error?: string; showDivider?: boolean };

/** Campo de texto con etiqueta, integrado en las tarjetas de formulario. */
export function TextField({ label, error, showDivider, style, multiline, ...rest }: TextFieldProps) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={[styles.textField, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        accessibilityLabel={label}
        multiline={multiline}
        {...rest}
        style={[
          typography.bodyStrong,
          styles.input,
          { color: colors.text, minHeight: multiline ? 64 : 26 },
          multiline && { textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <AppText variant="footnote" color="negative">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  trailingIcon?: IconName;
};

/** Botón de filtro. Seleccionado se rellena con el color principal. */
export function FilterChip({ label, selected, onPress, icon, trailingIcon }: ChipProps) {
  const { colors, radius } = useAppTheme();
  const tint = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.sm,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={tint} /> : null}
      <AppText variant="subhead" style={{ color: tint }} numberOfLines={1}>
        {label}
      </AppText>
      {trailingIcon ? <Icon name={trailingIcon} size={10} color={tint} weight="bold" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  error: { paddingBottom: 8 },
  textField: { paddingVertical: 10, gap: 4 },
  input: { padding: 0, margin: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
});
