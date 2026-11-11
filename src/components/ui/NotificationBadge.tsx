import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

type Props = { count: number; max?: number };

/** Contador de avisos sin leer. Se ubica sobre la esquina de un ícono. */
export function NotificationBadge({ count, max = 9 }: Props) {
  const { colors } = useAppTheme();
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <View
      accessibilityLabel={`${count} avisos sin leer`}
      style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}
    >
      <AppText variant="caption" style={[styles.text, { color: '#14251F' }]} maxFontSizeMultiplier={1.2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 10.5, lineHeight: 13, fontFamily: 'Inter_700Bold' },
});
