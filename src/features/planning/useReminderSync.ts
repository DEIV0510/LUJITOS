/**
 * Mantiene los recordatorios del iPhone al día con los datos reales: cada vez
 * que cambian las deudas, tarjetas, metas o presupuestos (y si el usuario los
 * activó y dio permiso), se reprograman. Los presupuestos superados se avisan
 * una sola vez por período.
 */
import { useEffect, useMemo } from 'react';

import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { nowInBogota, type ISODate } from '@/lib/dates';
import { bogotaMorning, getPermissionState, notifyOnce, remindersEnabled, replaceScheduled } from '@/lib/notifications';

import { budgetName } from './labels';
import { notificationDate, upcomingReminders, type Reminder } from './reminders';

export function useReminders(horizonDays = 30): Reminder[] {
  const { debts, accounts, goals, budgets, getCategory } = useFinanceData();
  return useMemo(
    () =>
      upcomingReminders({
        today: nowInBogota().date,
        debts,
        accounts,
        goals,
        budgets,
        budgetName: (budget) => budgetName(budget, budget.categoryId ? getCategory(budget.categoryId) : undefined),
        horizonDays,
      }),
    [debts, accounts, goals, budgets, getCategory, horizonDays],
  );
}

/** Reprograma los recordatorios del iPhone. Devuelve cuántos quedaron programados. */
export function scheduleReminders(reminders: Reminder[], today: ISODate): Promise<number> {
  return replaceScheduled(
    reminders.flatMap((reminder) => {
      const date = notificationDate(reminder, today);
      return date ? [{ id: reminder.id, title: reminder.title, body: reminder.body, at: bogotaMorning(date) }] : [];
    }),
  );
}

export function useReminderSync(): void {
  const { mode, status } = useFinanceData();
  const reminders = useReminders(60);
  // Solo se reprograma cuando cambia algo que se ve en un recordatorio.
  const signature = reminders.map((r) => `${r.id}|${r.body}`).join('\n');

  useEffect(() => {
    if (mode !== 'live' || status !== 'ready') return;
    let cancelled = false;
    void (async () => {
      if (!(await remindersEnabled()) || (await getPermissionState()) !== 'granted' || cancelled) return;
      await scheduleReminders(reminders, nowInBogota().date);
      for (const reminder of reminders.filter((r) => r.kind === 'budget')) {
        if (cancelled) return;
        await notifyOnce(reminder.id, reminder.title, reminder.body);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la firma resume los recordatorios
  }, [mode, status, signature]);
}
