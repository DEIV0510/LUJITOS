/**
 * Próximos pagos y recordatorios, calculados de los datos reales:
 *   - cuotas de deudas (próximo pago según las cuotas registradas),
 *   - pago de tarjetas con deuda (día límite de pago),
 *   - metas con fecha cercana que aún no se cumplen,
 *   - presupuestos superados en el período actual.
 * Cálculo puro: lo usan el panel, la pantalla de avisos y las notificaciones.
 */
import { addDays, diffInDays, type ISODate } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';
import { cardDebt, nextDayOfMonth } from '@/features/accounts/display';
import type { Account } from '@/types/finance';
import type { Budget, DebtRecord, Goal } from '@/types/planning';

export type ReminderKind = 'debt' | 'card' | 'goal' | 'budget';

export type Reminder = {
  /** Estable entre recargas (sirve para no repetir notificaciones). */
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** Fecha del pago o de la meta. */
  date: ISODate;
  amount: Money | null;
  overdue: boolean;
  href: { pathname: string; params?: Record<string, string> };
};

type Input = {
  today: ISODate;
  debts: DebtRecord[];
  accounts: Account[];
  goals: Goal[];
  budgets: Budget[];
  budgetName: (budget: Budget) => string;
  /** Días hacia adelante que se miran (por defecto 30). */
  horizonDays?: number;
};

export function upcomingReminders({ today, debts, accounts, goals, budgets, budgetName, horizonDays = 30 }: Input): Reminder[] {
  const limit = addDays(today, horizonDays);
  const list: Reminder[] = [];

  for (const debt of debts) {
    if (!debt.isActive || debt.outstanding <= 0 || !debt.nextPaymentDate || debt.nextPaymentDate > limit) continue;
    const overdue = debt.nextPaymentDate < today;
    list.push({
      id: `debt:${debt.id}:${debt.nextPaymentDate}`,
      kind: 'debt',
      title: overdue ? `Cuota vencida · ${debt.name}` : `Cuota de ${debt.name}`,
      body: debt.installment ? `${formatMoney(debt.installment)} · debes ${formatMoney(debt.outstanding)}` : `Debes ${formatMoney(debt.outstanding)}`,
      date: debt.nextPaymentDate,
      amount: debt.installment,
      overdue,
      href: { pathname: '/debt/[id]', params: { id: debt.id } },
    });
  }

  for (const account of accounts) {
    if (account.kind !== 'credit_card' || account.isActive === false || !account.paymentDueDay) continue;
    const debt = cardDebt(account);
    if (debt <= 0) continue;
    const date = nextDayOfMonth(account.paymentDueDay, today);
    if (date > limit) continue;
    list.push({
      id: `card:${account.id}:${date}`,
      kind: 'card',
      title: `Pago de la tarjeta ${account.name}`,
      body: `Debes ${formatMoney(debt)}`,
      date,
      amount: debt,
      overdue: false,
      href: { pathname: '/account/[id]', params: { id: account.id } },
    });
  }

  for (const goal of goals) {
    if (goal.state !== 'active' && goal.state !== 'overdue') continue;
    if (!goal.targetDate || goal.remaining <= 0) continue;
    const overdue = goal.state === 'overdue';
    if (!overdue && goal.targetDate > limit) continue;
    list.push({
      id: `goal:${goal.id}:${goal.targetDate}`,
      kind: 'goal',
      title: overdue ? `Meta vencida · ${goal.name}` : `Meta ${goal.name}`,
      body: `Faltan ${formatMoney(goal.remaining)}`,
      date: goal.targetDate,
      amount: goal.remaining,
      overdue,
      href: { pathname: '/goal/[id]', params: { id: goal.id } },
    });
  }

  for (const budget of budgets) {
    if (budget.state !== 'exceeded') continue;
    list.push({
      id: `budget:${budget.id}:${budget.periodStart}`,
      kind: 'budget',
      title: `Superaste ${budgetName(budget)}`,
      body: `Gastaste ${formatMoney(budget.spent)} de ${formatMoney(budget.limit)}`,
      date: today,
      amount: -budget.available,
      overdue: false,
      href: { pathname: '/budget/[id]', params: { id: budget.id } },
    });
  }

  return list.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date.localeCompare(b.date)));
}

/**
 * Cuándo avisar en el teléfono (a las 9:00 de Bogotá):
 * cuotas y tarjetas un día antes; metas una semana antes. Nada en el pasado.
 * Los presupuestos superados se avisan en el momento (no se programan).
 */
export function notificationDate(reminder: Reminder, today: ISODate): ISODate | null {
  if (reminder.kind === 'budget' || reminder.overdue) return null;
  const before = reminder.kind === 'goal' ? 7 : 1;
  const date = addDays(reminder.date, -before);
  if (diffInDays(today, date) < 0) return reminder.date > today ? addDays(today, 1) : null;
  return date;
}
