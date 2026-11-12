/**
 * Avisos y recordatorios con datos reales: próximos pagos (deudas y tarjetas),
 * metas cercanas, presupuestos superados y los avisos de presupuesto.
 * Los recordatorios en el iPhone se activan aquí (el permiso se pide en ese
 * momento, no al abrir la app).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { diffInDays, formatShortDate, nowInBogota } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  getPermissionState,
  remindersEnabled,
  requestPermission,
  scheduledCount,
  setRemindersEnabled,
  type PermissionState,
} from '@/lib/notifications';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';
import type { Tone } from '@/theme';

import { budgetName, relativeDays } from '../labels';
import type { ReminderKind } from '../reminders';
import { scheduleReminders, useReminders } from '../useReminderSync';
import { Note } from '../ui';

const KIND_ICON: Record<ReminderKind, { icon: IconName; tone: Tone }> = {
  debt: { icon: 'banknote', tone: 'clay' },
  card: { icon: 'creditcard.fill', tone: 'gold' },
  goal: { icon: 'target', tone: 'teal' },
  budget: { icon: 'exclamationmark.triangle.fill', tone: 'rose' },
};

export function AlertsScreen() {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const today = nowInBogota().date;
  const { budgetAlerts, getBudget, getCategory, markAlertsSeen } = useFinanceData();
  const reminders = useReminders(30);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [scheduled, setScheduled] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  // Estado del permiso y de lo programado: se vuelve a leer al cambiar «version».
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    void Promise.all([remindersEnabled(), getPermissionState(), scheduledCount()]).then(([on, state, count]) => {
      if (!active) return;
      setEnabled(on);
      setPermission(state);
      setScheduled(count);
    });
    return () => {
      active = false;
    };
  }, [version]);

  // Al abrir la pantalla, los avisos de presupuesto quedan vistos.
  const unseen = budgetAlerts.filter((a) => !a.seenAt).map((a) => a.id);
  const unseenKey = unseen.join(',');
  useEffect(() => {
    if (!unseenKey) return;
    const timer = setTimeout(() => void markAlertsSeen(unseenKey.split(',')).catch(() => undefined), 1500);
    return () => clearTimeout(timer);
  }, [unseenKey, markAlertsSeen]);

  const toggle = async (next: boolean) => {
    setMessage(null);
    if (!next) {
      await setRemindersEnabled(false);
      refresh();
      return;
    }
    const state = permission === 'granted' ? 'granted' : await requestPermission();
    setPermission(state);
    if (state !== 'granted') {
      setMessage('iOS no dio permiso para notificaciones. Puedes activarlo en Ajustes > Notificaciones.');
      return;
    }
    await setRemindersEnabled(true);
    const count = await scheduleReminders(reminders, today);
    refresh();
    setMessage(count > 0 ? `Programamos ${count} ${count === 1 ? 'recordatorio' : 'recordatorios'}.` : 'Activados. Aún no hay pagos próximos para recordar.');
  };

  return (
    <Screen header={<ScreenHeader title="Avisos" />}>
      <FinancialCard padding={spacing.lg} style={styles.list}>
        <ListRow
          title="Recordatorios en este iPhone"
          subtitle={
            enabled && permission === 'granted'
              ? `${scheduled} programados · cuotas y tarjetas un día antes, metas una semana antes`
              : 'Cuotas, pagos de tarjeta, metas y presupuestos superados'
          }
          icon="bell.fill"
          tone="amber"
          right={
            <Switch
              value={enabled && permission === 'granted'}
              onValueChange={(value) => void toggle(value)}
              trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
              thumbColor={colors.surface}
              accessibilityLabel="Recordatorios en este iPhone"
            />
          }
        />
      </FinancialCard>
      {message ? (
        <AppText variant="footnote" color={permission === 'denied' ? 'warning' : 'textSecondary'}>
          {message}
          {permission === 'denied' ? (
            <AppText variant="footnote" color="primary" onPress={() => void Linking.openSettings()}>
              {' '}Abrir Ajustes
            </AppText>
          ) : null}
        </AppText>
      ) : null}
      <Note>Son notificaciones locales: el iPhone las muestra a las 9:00 aunque LUJITOS esté cerrada. No se envía nada a ningún servidor.</Note>

      <View>
        <SectionHeader title="Próximos 30 días" />
        {reminders.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="checkmark.circle" title="Nada pendiente" message="Cuando tengas cuotas, pagos de tarjeta o metas cerca, aparecerán aquí." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.lg} style={styles.list}>
            {reminders.map((reminder, index) => (
              <ListRow
                key={reminder.id}
                title={reminder.title}
                subtitle={`${reminder.kind === 'budget' ? 'Este período' : `${formatShortDate(reminder.date)} · ${relativeDays(diffInDays(today, reminder.date))}`} · ${reminder.body}`}
                icon={KIND_ICON[reminder.kind].icon}
                tone={reminder.overdue ? 'rose' : KIND_ICON[reminder.kind].tone}
                showDivider={index > 0}
                onPress={() => router.push(reminder.href as never)}
              />
            ))}
          </FinancialCard>
        )}
      </View>

      <View>
        <SectionHeader title="Avisos de presupuestos" subtitle="Últimos 60 días" />
        {budgetAlerts.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="chart.pie" title="Sin avisos" message="Te avisamos al llegar a los porcentajes que elijas en cada presupuesto." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.lg} style={styles.list}>
            {budgetAlerts.slice(0, 40).map((alert, index) => {
              const budget = getBudget(alert.budgetId);
              const name = budget ? budgetName(budget, budget.categoryId ? getCategory(budget.categoryId) : undefined) : 'Presupuesto';
              return (
                <ListRow
                  key={alert.id}
                  title={alert.kind === 'exceeded' ? `Superaste ${name}` : `${name}: llegaste al ${alert.threshold} %`}
                  subtitle={`${formatShortDate(alert.createdAt.slice(0, 10))} · ${formatMoney(alert.spent, { hidden })} de ${formatMoney(alert.limit, { hidden })}${alert.seenAt ? '' : ' · nuevo'}`}
                  icon={alert.kind === 'exceeded' ? 'exclamationmark.triangle.fill' : 'bell.fill'}
                  tone={alert.kind === 'exceeded' ? 'rose' : 'amber'}
                  showDivider={index > 0}
                  onPress={budget ? () => router.push({ pathname: '/budget/[id]', params: { id: budget.id } }) : undefined}
                />
              );
            })}
          </FinancialCard>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
});
