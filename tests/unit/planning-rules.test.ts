/**
 * Reglas puras de la Fase 5: proyecciones (con sus supuestos), cuotas a valor
 * mensual, % de ahorro sin ingresos, validaciones de formularios, próximos
 * pagos y cuándo avisar en el iPhone.
 */
import { budgetName, periodLabel, relativeDays } from '@/features/planning/labels';
import { buildProjections, monthlyEquivalent, payoffMonths, savingsRate } from '@/features/planning/projections';
import { notificationDate, upcomingReminders } from '@/features/planning/reminders';
import {
  parseRate,
  validateBudgetDraft,
  validateDebtDraft,
  validateGoalDraft,
  validateInterestPortion,
  validatePaymentAmount,
} from '@/features/planning/validation';
import type { Account, Category } from '@/types/finance';
import type { Budget, DebtRecord, Goal } from '@/types/planning';

const TODAY = '2026-11-12';

describe('Proyecciones', () => {
  it('sin historial no se proyecta nada (no se inventan datos)', () => {
    expect(buildProjections({ basis: 'none', savingsAvg: null, obligationsMonthly: 0 }, { netWorth: 0, loanDebt: 0 })).toBeNull();
  });

  it('3, 6 y 12 meses: patrimonio + ahorro promedio; préstamos − cuotas (sin bajar de cero)', () => {
    const rows = buildProjections(
      { basis: 'current_month', savingsAvg: 800000, obligationsMonthly: 400000 },
      { netWorth: 7000000, loanDebt: 2100000 },
    );
    expect(rows).toEqual([
      { months: 3, netWorth: 9400000, saved: 2400000, loanDebt: 900000 },
      { months: 6, netWorth: 11800000, saved: 4800000, loanDebt: 0 },
      { months: 12, netWorth: 16600000, saved: 9600000, loanDebt: 0 },
    ]);
  });

  it('si se gasta más de lo que entra, la proyección baja', () => {
    const rows = buildProjections({ basis: 'complete_months', savingsAvg: -100000, obligationsMonthly: 0 }, { netWorth: 1000000, loanDebt: 0 });
    expect(rows?.[2]).toEqual({ months: 12, netWorth: -200000, saved: -1200000, loanDebt: 0 });
  });

  it('cuotas llevadas a valor mensual (mismo criterio que planning_snapshot)', () => {
    expect(monthlyEquivalent(120000, 'monthly')).toBe(120000);
    expect(monthlyEquivalent(1200, 'biweekly')).toBe(2600);
    expect(monthlyEquivalent(1200, 'weekly')).toBe(5200);
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100);
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100);
    expect(monthlyEquivalent(5000, 'none')).toBe(0);
  });

  it('meses para terminar de pagar (sin intereses)', () => {
    expect(payoffMonths(4500000, 500000, 'monthly')).toBe(9);
    expect(payoffMonths(4500000, 250000, 'biweekly')).toBe(9);
    expect(payoffMonths(4500000, null, 'monthly')).toBeNull();
    expect(payoffMonths(4500000, 500000, 'none')).toBeNull();
    expect(payoffMonths(0, 500000, 'monthly')).toBe(0);
  });

  it('% de ahorro: sin ingresos queda vacío; con ingresos, dos decimales', () => {
    expect(savingsRate(0, 100000)).toBeNull();
    expect(savingsRate(3000000, 2200000)).toBe(26.67);
    expect(savingsRate(1000000, 1500000)).toBe(-50);
  });
});

describe('Validaciones', () => {
  const budget = { limit: 500000, period: 'monthly' as const, startDate: TODAY, endDate: null, thresholds: [50, 75, 90, 100], name: '' };

  it('presupuesto válido y sus errores', () => {
    expect(validateBudgetDraft(budget)).toEqual({});
    expect(validateBudgetDraft({ ...budget, limit: 0 }).limit).toBeDefined();
    expect(validateBudgetDraft({ ...budget, period: 'custom' }).endDate).toBe('Elige hasta cuándo va el período.');
    expect(validateBudgetDraft({ ...budget, endDate: '2026-11-01' }).endDate).toBeDefined();
    expect(validateBudgetDraft({ ...budget, thresholds: [10, 20, 30, 40, 50, 60, 70] }).thresholds).toBeDefined();
    expect(validateBudgetDraft({ ...budget, thresholds: [] })).toEqual({});
  });

  it('meta: nombre, objetivo y fecha', () => {
    const goal = { name: 'Viaje', target: 8000000, initialSaved: 2000000, startDate: TODAY, targetDate: null, description: '' };
    expect(validateGoalDraft(goal)).toEqual({});
    expect(validateGoalDraft({ ...goal, name: '  ' }).name).toBeDefined();
    expect(validateGoalDraft({ ...goal, target: 0 }).target).toBeDefined();
    expect(validateGoalDraft({ ...goal, initialSaved: -1 }).initialSaved).toBeDefined();
    expect(validateGoalDraft({ ...goal, targetDate: '2026-01-01' }).targetDate).toBeDefined();
  });

  it('tasa escrita con coma o punto, vacía = sin interés', () => {
    expect(parseRate('1,5')).toBe(1.5);
    expect(parseRate(' 25% ')).toBe(25);
    expect(parseRate('')).toBeNull();
    expect(parseRate('abc')).toBeNaN();
    expect(parseRate('1.23456')).toBeNaN();
  });

  it('deuda: con cuotas exige valor y próxima fecha', () => {
    const debt = {
      name: 'Crédito carro',
      creditor: '',
      originalAmount: 5000000,
      outstanding: 5000000,
      rateText: '',
      ratePeriod: 'monthly' as const,
      startDate: TODAY,
      dueDate: null,
      frequency: 'monthly' as const,
      installment: 500000,
      firstPaymentDate: TODAY,
      description: '',
    };
    expect(validateDebtDraft(debt)).toEqual({});
    const missing = validateDebtDraft({ ...debt, installment: 0, firstPaymentDate: null });
    expect(missing.installment).toBeDefined();
    expect(missing.firstPaymentDate).toBeDefined();
    expect(validateDebtDraft({ ...debt, frequency: 'none', installment: 0, firstPaymentDate: null })).toEqual({});
    expect(validateDebtDraft({ ...debt, rateText: 'uno' }).rate).toBeDefined();
    expect(validateDebtDraft({ ...debt, outstanding: 0 }).outstanding).toBeDefined();
  });

  it('pagos: valor positivo e intereses no mayores que el pago', () => {
    expect(validatePaymentAmount(0)).toBeDefined();
    expect(validatePaymentAmount(500000)).toBeUndefined();
    expect(validateInterestPortion(600000, 500000)).toBeDefined();
    expect(validateInterestPortion(100000, 500000)).toBeUndefined();
  });
});

describe('Textos', () => {
  it('períodos legibles', () => {
    expect(periodLabel('monthly', '2026-11-01', '2026-11-30')).toBe('Noviembre 2026');
    expect(periodLabel('weekly', '2026-11-09', '2026-11-15')).toBe('9–15 nov');
    expect(periodLabel('yearly', '2026-01-01', '2026-12-31')).toBe('2026');
    expect(periodLabel('custom', '2026-12-20', '2027-01-10')).toBe('20 dic – 10 ene 2027');
  });

  it('nombre del presupuesto: escrito, de la categoría o general', () => {
    const food = { id: 'food', name: 'Alimentación' } as Category;
    expect(budgetName({ name: 'Mercado', categoryId: 'food' }, food)).toBe('Mercado');
    expect(budgetName({ name: null, categoryId: 'food' }, food)).toBe('Alimentación');
    expect(budgetName({ name: null, categoryId: null }, undefined)).toBe('Presupuesto general');
  });

  it('días relativos', () => {
    expect(relativeDays(0)).toBe('Hoy');
    expect(relativeDays(1)).toBe('Mañana');
    expect(relativeDays(-3)).toBe('Hace 3 días');
    expect(relativeDays(5)).toBe('En 5 días');
  });
});

describe('Próximos pagos y recordatorios', () => {
  const debt = (patch: Partial<DebtRecord>): DebtRecord =>
    ({
      id: 'd1',
      accountId: 'loan1',
      name: 'Crédito carro',
      isActive: true,
      installment: 500000,
      outstanding: 4500000,
      nextPaymentDate: '2026-11-17',
      state: 'active',
      ...patch,
    }) as DebtRecord;
  const goal = (patch: Partial<Goal>): Goal =>
    ({ id: 'g1', name: 'Viaje', state: 'active', targetDate: '2026-12-01', remaining: 700000, ...patch }) as Goal;
  const card = {
    id: 'tc',
    name: 'Visa',
    kind: 'credit_card',
    balance: -700000,
    paymentDueDay: 20,
    isActive: true,
  } as Account;
  const exceeded = { id: 'b1', state: 'exceeded', spent: 550000, limit: 500000, available: -50000, periodStart: '2026-11-01' } as Budget;

  it('reúne cuotas, tarjetas, metas y presupuestos superados, ordenados por fecha', () => {
    const list = upcomingReminders({
      today: TODAY,
      debts: [
        debt({}),
        debt({ id: 'd2', name: 'Vencida', nextPaymentDate: '2026-11-02', state: 'overdue' }),
        debt({ id: 'd3', isActive: false }),
        debt({ id: 'd4', outstanding: 0 }),
      ],
      accounts: [card, { ...card, id: 'tc2', balance: 0 } as Account],
      goals: [goal({}), goal({ id: 'g2', state: 'completed' }), goal({ id: 'g3', targetDate: '2027-03-01' })],
      budgets: [exceeded],
      budgetName: () => 'Comida',
    });
    expect(list.map((r) => r.id)).toEqual([
      'debt:d2:2026-11-02',
      'budget:b1:2026-11-01',
      'debt:d1:2026-11-17',
      'card:tc:2026-11-20',
      'goal:g1:2026-12-01',
    ]);
    expect(list[0]!.overdue).toBe(true);
    expect(list[1]!.title).toBe('Superaste Comida');
  });

  it('cuándo avisar: cuotas un día antes, metas una semana antes, nada en el pasado', () => {
    const base = { id: 'x', title: '', body: '', amount: null, overdue: false, href: { pathname: '/' } };
    expect(notificationDate({ ...base, kind: 'debt', date: '2026-11-17' }, TODAY)).toBe('2026-11-16');
    expect(notificationDate({ ...base, kind: 'goal', date: '2026-12-12' }, TODAY)).toBe('2026-12-05');
    expect(notificationDate({ ...base, kind: 'goal', date: '2026-11-15' }, TODAY)).toBe('2026-11-13');
    expect(notificationDate({ ...base, kind: 'debt', date: TODAY }, TODAY)).toBeNull();
    expect(notificationDate({ ...base, kind: 'budget', date: TODAY }, TODAY)).toBeNull();
    expect(notificationDate({ ...base, kind: 'debt', date: '2026-11-02', overdue: true }, TODAY)).toBeNull();
  });
});
