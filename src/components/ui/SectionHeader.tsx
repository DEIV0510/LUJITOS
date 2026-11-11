import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Título de sección con acción opcional («Ver todas»). */
export function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          onPress={() => {
            haptics.selection();
            onAction();
          }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        >
          <AppText variant="subhead" color="primary">
            {actionLabel}
          </AppText>
          <Icon name="chevron.right" size={11} color={colors.primary} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  texts: { flex: 1, gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
});
