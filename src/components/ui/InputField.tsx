import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Muestra el botón para ver u ocultar la contraseña. */
  secureToggle?: boolean;
};

/** Campo de formulario con etiqueta, ícono, error y opción de mostrar la contraseña. */
export const InputField = forwardRef<ComponentRef<typeof TextInput>, Props>(function InputField(
  { label, error, hint, icon, secureToggle, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, radius, typography, spacing } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hidden = secureToggle ? !visible : secureTextEntry;
  const borderColor = error ? colors.negative : focused ? colors.primary : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor, borderRadius: radius.md, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {icon ? <Icon name={icon} size={17} color={focused ? colors.primary : colors.textTertiary} /> : null}
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[typography.body, styles.input, { color: colors.text }, style]}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={10}
            onPress={() => {
              haptics.selection();
              setVisible((current) => !current);
            }}
            style={styles.toggle}
          >
            <Icon name={visible ? 'eye.slash.fill' : 'eye.fill'} size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="footnote" color="negative" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color="textTertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderCurve: 'continuous' },
  input: { flex: 1, paddingVertical: 12, margin: 0 },
  toggle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
