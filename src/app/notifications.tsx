import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/States';
import { DEMO_NOTIFICATIONS, DEMO_TODAY } from '@/features/demo/data';
import { formatDayHeading } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { resolveTone, useAppTheme, type Tone } from '@/theme';
import type { AppNotification, IconName } from '@/types/finance';

const KIND: Record<AppNotification['kind'], { icon: IconName; tone: Tone }> = {
  budget: { icon: 'chart.pie.fill', tone: 'amber' },
  due: { icon: 'calendar', tone: 'slate' },
  goal: { icon: 'target', tone: 'teal' },
  info: { icon: 'info.circle', tone: 'stone' },
};

export default function NotificationsScreen() {
  const { colors, spacing, scheme } = useAppTheme();
  const [readIds, setReadIds] = useState<string[]>([]);
  const items = DEMO_NOTIFICATIONS.map((n) => ({ ...n, read: n.read || readIds.includes(n.id) }));
  const unread = items.filter((n) => !n.read);
  const earlier = items.filter((n) => n.read);

  const markAll = () => {
    haptics.selection();
    setReadIds(DEMO_NOTIFICATIONS.map((n) => n.id));
  };

  const renderGroup = (title: string, list: typeof items) =>
    list.length > 0 ? (
      <View>
        <SectionHeader title={title} />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {list.map((notification, index) => {
            const kind = KIND[notification.kind];
            return (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                accessibilityLabel={`${notification.title}. ${notification.body}`}
                onPress={() => {
                  setReadIds((current) => [...current, notification.id]);
                  if (notification.href) router.push(notification.href as Href);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: resolveTone(kind.tone, scheme).soft }]}>
                  <Icon name={kind.icon} size={16} color={resolveTone(kind.tone, scheme).ink} />
                </View>
                <View style={styles.texts}>
                  <View style={styles.titleRow}>
                    <AppText variant="bodyStrong" style={styles.flex}>
                      {notification.title}
                    </AppText>
                    {!notification.read ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                  </View>
                  <AppText variant="footnote" color="textSecondary">
                    {notification.body}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {formatDayHeading(notification.date, DEMO_TODAY)}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </FinancialCard>
      </View>
    ) : null;

  return (
    <Screen
      header={
        <ScreenHeader
          title="Notificaciones"
          right={
            unread.length > 0 ? (
              <Pressable accessibilityRole="button" onPress={markAll} hitSlop={8} style={styles.markAll}>
                <AppText variant="subhead" color="primary">
                  Leídas
                </AppText>
              </Pressable>
            ) : null
          }
        />
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="bell.fill" title="Sin avisos" message="Aquí verás alertas de presupuesto, vencimientos y metas." />
      ) : (
        <>
          {renderGroup('Nuevas', unread)}
          {renderGroup('Anteriores', earlier)}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  markAll: { minHeight: 44, justifyContent: 'center' },
});
