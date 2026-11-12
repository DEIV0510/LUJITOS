/**
 * Las pantallas de la Fase 5 se dibujan sin errores con datos reales de
 * ejemplo: presupuestos (general, superado, archivado), metas (con y sin
 * cuenta, vencida, cumplida), deudas (al día y vencida), planificación
 * preliminar, avisos y el Inicio con sus nuevas secciones.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { addDays, nowInBogota } from '@/lib/dates';
import type { Account, Category, Transaction } from '@/types/finance';
import type { Budget, DebtRecord, Goal, GoalMovement, PlanningSnapshot } from '@/types/planning';

const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  const Stack = Object.assign(() => null, { Screen: () => null });
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams.current,
    useSegments: () => [],
    Stack,
    Link: View,
  };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const entering = { duration: () => entering, delay: () => entering, springify: () => entering, damping: () => entering };
  const shared = (initial: unknown) => ({ value: initial, get: () => initial, set: () => undefined });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    FadeIn: entering,
    FadeInDown: entering,
    FadeInUp: entering,
    FadeInRight: entering,
    ZoomIn: entering,
    SlideInDown: entering,
    Easing: { out: () => undefined, cubic: undefined, inOut: () => undefined },
    useSharedValue: shared,
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useReducedMotion: () => true,
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (value: unknown) => value,
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(async () => ({ data: [], error: null })) } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/lib/notifications', () => ({
  getPermissionState: jest.fn(async () => 'undetermined'),
  remindersEnabled: jest.fn(async () => false),
  requestPermission: jest.fn(async () => 'granted'),
  scheduledCount: jest.fn(async () => 0),
  setRemindersEnabled: jest.fn(async () => undefined),
  replaceScheduled: jest.fn(async () => 0),
  notifyOnce: jest.fn(async () => false),
  bogotaMorning: (date: string) => new Date(`${date}T14:00:00Z`),
}));
jest.mock('@/hooks/auth', () => ({ useAuth: () => ({ profile: { first_name: 'David', last_name: '' }, session: null }) }));

const today = nowInBogota().date;
const monthStart = `${today.slice(0, 7)}-01`;

const accounts: Account[] = [
  { id: 'bc', name: 'Ahorros nómina', institutionId: 'bancolombia', kind: 'savings', balance: 3000000, initialBalance: 3000000, currency: 'COP', createdAt: monthStart, method: 'manual', isActive: true },
  { id: 'tc', name: 'Visa', institutionId: 'bancolombia', kind: 'credit_card', balance: -500000, initialBalance: -500000, creditLimit: 3000000, paymentDueDay: 28, currency: 'COP', createdAt: monthStart, method: 'manual', isActive: true },
];
const loan: Account = { id: 'loan1', name: 'Crédito carro', institutionId: 'custom', institutionName: 'Banco de Bogotá', kind: 'loan', balance: -4500000, initialBalance: -5000000, currency: 'COP', createdAt: monthStart, method: 'manual', isActive: true, color: 'rose' };

const categories: Category[] = [
  { id: 'food', name: 'Alimentación', kind: 'expense', icon: 'fork.knife', tone: 'gold', slug: 'food', isDefault: true, isEssential: true },
  { id: 'fees', name: 'Intereses y comisiones', kind: 'expense', icon: 'percent', tone: 'clay', slug: 'fees', isDefault: true },
  { id: 'salary', name: 'Salario', kind: 'income', icon: 'briefcase.fill', tone: 'forest', slug: 'salary', isDefault: true },
];

const transactions: Transaction[] = [
  { id: 't1', type: 'expense', amount: 300000, accountId: 'bc', categoryId: 'food', description: 'Mercado', date: today },
  { id: 't2', type: 'transfer', amount: 500000, accountId: 'bc', toAccountId: 'loan1', description: 'Cuota · Crédito carro', date: today, purpose: 'debt_installment' },
];

const budgetBase: Pick<Budget, 'name' | 'startDate' | 'endDate' | 'thresholds' | 'archivedAt' | 'createdAt' | 'periodStart' | 'periodEnd' | 'daysLeft' | 'previousPeriodStart' | 'previousSpent'> = { name: null, startDate: monthStart, endDate: null, thresholds: [50, 75, 90, 100], archivedAt: null, createdAt: monthStart, periodStart: monthStart, periodEnd: addDays(monthStart, 29), daysLeft: 18, previousPeriodStart: null, previousSpent: null };
const budgets: Budget[] = [
  { ...budgetBase, id: 'b-general', categoryId: null, limit: 2000000, period: 'monthly', spent: 300000, available: 1700000, percentUsed: 15, state: 'active', previousSpent: 1800000 },
  { ...budgetBase, id: 'b-food', categoryId: 'food', limit: 250000, period: 'monthly', spent: 300000, available: -50000, percentUsed: 120, state: 'exceeded' },
  { ...budgetBase, id: 'b-old', categoryId: 'fees', limit: 100000, period: 'weekly', spent: 0, available: 100000, percentUsed: 0, state: 'archived', archivedAt: '2026-11-01T00:00:00Z' },
];

const goalBase = { description: null, initialSaved: 0, startDate: '2026-01-01', color: null, icon: null, archivedAt: null, createdAt: monthStart, contributed: 0, withdrawn: 0, exceededBy: 0, accountBalance: null, accountAllocated: null, movementCount: 0, lastMovementDate: null, weeklyNeeded: null, dailyNeeded: null } as const;
const goals: Goal[] = [
  { ...goalBase, id: 'g-casa', name: 'Casa', kind: 'home', target: 1000000, saved: 300000, remaining: 700000, percent: 30, targetDate: addDays(today, 60), daysLeft: 60, state: 'active', monthlyNeeded: 350000, weeklyNeeded: 77778, dailyNeeded: 11667, accountId: 'bc', unassigned: false, accountBalance: 3000000, accountAllocated: 300000, movementCount: 1 },
  { ...goalBase, id: 'g-viaje', name: 'Viaje', kind: 'travel', target: 8000000, saved: 2500000, remaining: 5500000, percent: 31.25, targetDate: null, daysLeft: null, state: 'active', monthlyNeeded: null, accountId: null, unassigned: true },
  { ...goalBase, id: 'g-curso', name: 'Curso', kind: 'education', target: 2000000, saved: 0, remaining: 2000000, percent: 0, targetDate: '2025-06-01', daysLeft: -500, state: 'overdue', monthlyNeeded: null, accountId: null, unassigned: true },
  { ...goalBase, id: 'g-moto', name: 'Moto', kind: 'vehicle', target: 1000000, saved: 1200000, remaining: 0, percent: 120, exceededBy: 200000, targetDate: null, daysLeft: null, state: 'completed', monthlyNeeded: null, accountId: null, unassigned: true },
];
const goalMovements: GoalMovement[] = [
  { id: 'm1', goalId: 'g-casa', kind: 'contribution', amount: 300000, date: today, note: 'Prima', transactionId: null, voidedAt: null, voidReason: null, createdAt: today },
];

const debtBase = { accountId: 'loan1', color: 'rose', isActive: true, creditor: 'Banco de Bogotá', interestRate: 1.5, interestPeriod: 'monthly', startDate: monthStart, dueDate: null, frequency: 'monthly', firstPaymentDate: today, paymentAccountId: 'bc', description: null, createdAt: monthStart, creditBalance: 0, initialOutstanding: 5000000, paidBefore: 0, interestRegistered: 0, disbursed: 0, daysToDue: null } as const;
const debts: DebtRecord[] = [
  { ...debtBase, id: 'd-carro', name: 'Crédito carro', kind: 'vehicle', originalAmount: 5000000, installment: 500000, outstanding: 4500000, totalPaid: 500000, installmentsPaid: 1, lastPaymentDate: today, percentPaid: 10, nextPaymentDate: addDays(today, 5), daysToNextPayment: 5, state: 'active' },
  { ...debtBase, id: 'd-tio', name: 'Préstamo tío', kind: 'personal', creditor: null, originalAmount: 1000000, installment: 100000, outstanding: 1000000, totalPaid: 0, installmentsPaid: 0, lastPaymentDate: null, percentPaid: 0, nextPaymentDate: addDays(today, -10), daysToNextPayment: -10, state: 'overdue', accountId: 'loan2' },
];

const planning: PlanningSnapshot = {
  basis: 'current_month',
  monthsUsed: 0,
  preliminary: true,
  incomeAvg: 3000000,
  expenseAvg: 2200000,
  essentialAvg: 1800000,
  fixedAvg: 1000000,
  variableAvg: 1200000,
  savingsAvg: 800000,
  savingsRate: 26.67,
  obligationsMonthly: 400000,
  obligationDebts: 1,
  savingsCapacity: 800000,
  goalsMonthlyNeeded: 350000,
  activeGoals: 2,
};

const mockData = { accounts, loan, categories, transactions, budgets, goals, goalMovements, debts, planning, monthStart, today };

jest.mock('@/features/data/FinanceDataProvider', () => {
  const noop = jest.fn(async () => undefined);
  const byId = <T extends { id: string }>(list: T[]) => (id: string | undefined) => list.find((item) => item.id === id);
  return {
    useFinanceData: () => ({
      mode: 'live',
      setMode: jest.fn(),
      status: 'ready',
      error: null,
      accounts: mockData.accounts,
      activeAccounts: mockData.accounts,
      loanAccounts: [mockData.loan],
      categories: mockData.categories,
      transactions: mockData.transactions,
      voidedTransactions: [],
      summary: {
        available: 3000000,
        banks: 3000000,
        wallets: 0,
        cash: 0,
        invested: 0,
        other: 0,
        cardDebt: 500000,
        loanDebt: 5500000,
        totalDebt: 6000000,
        assets: 3000000,
        liabilities: 6000000,
        creditLimit: 3000000,
        creditAvailable: 2500000,
        netWorth: -3000000,
        accounts: 2,
        debts: 2,
        monthStart: mockData.monthStart,
        monthIncome: 3000000,
        monthExpense: 2200000,
        monthSavings: 800000,
        savingsRate: 26.67,
      },
      budgets: mockData.budgets,
      budgetAlerts: [
        { id: 'a1', budgetId: 'b-food', periodStart: mockData.monthStart, kind: 'exceeded', threshold: 100, spent: 300000, limit: 250000, createdAt: `${mockData.today}T15:00:00Z`, seenAt: null },
        { id: 'a2', budgetId: 'b-food', periodStart: mockData.monthStart, kind: 'threshold', threshold: 50, spent: 150000, limit: 250000, createdAt: `${mockData.today}T12:00:00Z`, seenAt: `${mockData.today}T13:00:00Z` },
      ],
      goals: mockData.goals,
      goalMovements: mockData.goalMovements,
      debts: mockData.debts,
      planning: mockData.planning,
      monthSpending: [
        { categoryId: 'food', total: 300000, movements: 1 },
        { categoryId: 'fees', total: 50000, movements: 1 },
      ],
      getAccount: byId([...mockData.accounts, mockData.loan]),
      getCategory: (id: string | undefined) =>
        mockData.categories.find((c) => c.id === id) ?? { id: 'transfer', name: 'Transferencia', kind: 'expense', icon: 'arrow.left.arrow.right', tone: 'stone' },
      getTransaction: byId(mockData.transactions),
      getBudget: byId(mockData.budgets),
      getGoal: byId(mockData.goals),
      getDebt: byId(mockData.debts),
      getDebtByAccount: (id: string | undefined) => mockData.debts.find((d) => d.accountId === id),
      reload: noop,
      markAlertsSeen: noop,
      createBudget: noop,
      updateBudget: noop,
      setBudgetArchived: noop,
      deleteBudget: noop,
      createGoal: noop,
      updateGoal: noop,
      setGoalArchived: noop,
      deleteGoal: noop,
      addGoalMovement: noop,
      updateGoalMovement: noop,
      voidGoalMovement: noop,
      createDebt: noop,
      updateDebt: noop,
      setDebtArchived: noop,
      deleteDebt: noop,
      registerDebtPayment: noop,
    }),
  };
});

import BudgetsRoute from '@/app/(app)/budgets';
import DebtsRoute from '@/app/(app)/debts';
import NotificationsRoute from '@/app/(app)/notifications';
import SavingsRoute from '@/app/(app)/savings';
import { LiveHome } from '@/features/home/LiveHome';
import { BudgetForm } from '@/features/planning/BudgetForm';
import { DebtForm } from '@/features/planning/DebtForm';
import { DebtPaymentForm } from '@/features/planning/DebtPaymentForm';
import { GoalForm } from '@/features/planning/GoalForm';
import { GoalMovementForm } from '@/features/planning/GoalMovementForm';
import { BudgetDetailScreen } from '@/features/planning/screens/BudgetScreens';
import { DebtDetailScreen } from '@/features/planning/screens/DebtScreens';
import { GoalDetailScreen } from '@/features/planning/screens/GoalScreens';
import { PlanningScreen } from '@/features/planning/screens/PlanningScreen';
import { PrivacyProvider } from '@/features/privacy/PrivacyProvider';
import { ThemeProvider } from '@/theme';

async function show(element: ReactElement, params: Record<string, string> = {}) {
  mockParams.current = params;
  await render(
    <ThemeProvider>
      <PrivacyProvider>{element}</PrivacyProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

type Case = [name: string, element: () => ReactElement, expected: (string | RegExp)[], absent?: string[]];

const cases: Case[] = [
  ['Presupuestos: general, por categoría y archivados', () => <BudgetsRoute />, [/disponibles de/, 'Por categoría y período', 'Alimentación', 'Archivados', /Mes anterior completo/]],
  ['Detalle de un presupuesto superado', () => <BudgetDetailScreen id="b-food" />, ['Superado', 'Superaste el límite', 'Períodos', 'Gastos de este período', 'Eliminar presupuesto', 'Mercado']],
  ['Nuevo presupuesto', () => <BudgetForm />, ['Nuevo presupuesto', 'Avisarme al llegar a', 'Crear presupuesto', /General/]],
  ['Metas: resumen, estados y sin cuenta', () => <SavingsRoute />, ['Separado para tus metas', 'Casa', 'Sin cuenta asignada', 'Vencida', 'Cumplida']],
  ['Detalle de meta con recomendación', () => <GoalDetailScreen id="g-casa" />, ['Para llegar a tiempo, separa', 'Aportar', 'Retirar', 'Historial', /Prima/]],
  ['Meta vencida: sin recomendación negativa', () => <GoalDetailScreen id="g-curso" />, ['La fecha objetivo pasó', 'Cambiar la fecha'], ['Para llegar a tiempo, separa']],
  ['Meta superada', () => <GoalDetailScreen id="g-moto" />, ['Superada por', 'Cumplida']],
  ['Nueva meta', () => <GoalForm />, ['Nueva meta', 'Lo que ya tienes ahorrado para esta meta', 'Crear meta']],
  ['Aporte con cuenta', () => <GoalMovementForm goal={goals[0]!} />, ['Aportar a la meta', 'Mover dinero desde (opcional)', 'Registrar aporte']],
  ['Deudas: total, préstamos y tarjetas', () => <DebtsRoute />, ['Total que debes', 'Préstamos y deudas', 'Tarjetas de crédito', 'Crédito carro', 'Pago vencido']],
  ['Detalle de deuda', () => <DebtDetailScreen id="d-carro" />, ['Pagar cuota', 'Abono extra', 'Corregir saldo', 'Historial', 'Próxima cuota']],
  ['Nueva deuda', () => <DebtForm />, ['Nueva deuda', '¿Cuánto debes hoy?', 'Registrar deuda']],
  ['Pago de cuota con intereses', () => <DebtPaymentForm debt={debts[0]!} />, ['Valor de la cuota', 'De esta cuota, intereses (opcional)', 'Registrar cuota']],
  ['Planificación preliminar', () => <PlanningScreen />, [/Preliminar/, 'Capacidad de ahorro', 'Proyección', '3 m', '12 m', 'Gastos fijos y variables']],
  ['Avisos y recordatorios', () => <NotificationsRoute />, ['Recordatorios en este iPhone', 'Próximos 30 días', 'Avisos de presupuestos', /Superaste/]],
  ['Inicio con presupuesto, gasto, metas, deudas y pagos', () => <LiveHome />, ['Presupuesto', 'Gasto por categoría', 'Metas', 'Deudas', 'Próximos pagos', /Capacidad de ahorro al mes/, /avisos nuevos/]],
];

describe('Pantallas de la Fase 5 (se dibujan con datos reales de ejemplo)', () => {
  it.each(cases)('%s', async (_name, element, expected, absent = []) => {
    await show(element());
    for (const text of expected) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const text of absent) expect(screen.queryByText(text)).toBeNull();
  });
});
