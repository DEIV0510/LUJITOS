import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { resolveTone, useAppTheme, type Tone } from '@/theme';
import type { IconName } from '@/types/finance';

import { AppText } from './AppText';
import { Icon } from './Icon';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tone?: Tone;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  destructive?: boolean;
};

/** Fila de menú o de ajustes. Con onPress muestra chevron. */
export function ListRow({ title, subtitle, icon, tone, value, right, onPress, showDivider, destructive }: ListRowProps) {
  const { colors, scheme } = useAppTheme();
  const toneSet = tone ? resolveTone(tone, scheme) : null;
  const content = (
    <View style={[styles.row, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: toneSet?.soft ?? colors.primarySoft }]}>
          <Icon name={icon} size={17} color={destructive ? colors.negative : toneSet?.ink ?? colors.primary} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText variant="bodyStrong" color={destructive ? 'negative' : 'text'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="subhead" color="textSecondary" style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress ? <Icon name="chevron.right" size={13} color={colors.textTertiary} weight="semibold" /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      {content}
    </Pressable>
  );
}

type InfoRowProps = { label: string; value: string; showDivider?: boolean; valueColor?: 'text' | 'positive' | 'negative' };

/** Dato etiqueta/valor para pantallas de detalle. El valor puede ocupar varias líneas. */
export function InfoRow({ label, value, showDivider = true, valueColor = 'text' }: InfoRowProps) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.info, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
    >
      <AppText variant="callout" color="textSecondary" style={styles.infoLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={valueColor} align="right" style={styles.infoValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  value: { flexShrink: 1, textAlign: 'right' },
  info: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  infoLabel: { flexShrink: 0, maxWidth: '45%' },
  infoValue: { flex: 1 },
});
