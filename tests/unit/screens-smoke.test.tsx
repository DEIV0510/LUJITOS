/**
 * Las pantallas de la Fase 4 se dibujan sin errores con datos reales de ejemplo
 * (cuenta de ahorros, billetera y tarjeta con deuda; ingreso, gasto,
 * transferencia, ajuste y un movimiento anulado). Los datos llegan por
 * useFinanceData, igual que en la app.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { Account, Category, Transaction } from '@/types/finance';

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

const accounts: Account[] = [
  {
    id: 'bc',
    name: 'Ahorros nómina',
    institutionId: 'bancolombia',
    kind: 'savings',
    balance: 1800000,
    initialBalance: 2000000,
    currency: 'COP',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-10T10:00:00Z',
    method: 'manual',
    isActive: true,
    stats: {
      totalIncome: 200000,
      totalExpense: 150000,
      transfersIn: 0,
      transfersOut: 200000,
      adjustmentsNet: -12345,
      transactionCount: 4,
      lastTransactionDate: '2026-11-10',
      lastActivityAt: '2026-11-10T10:00:00Z',
    },
  },
  {
    id: 'nq',
    name: 'Nequi',
    institutionId: 'nequi',
    kind: 'digital_wallet',
    balance: 700000,
    initialBalance: 500000,
    currency: 'COP',
    createdAt: '2026-11-01',
    method: 'manual',
    isActive: true,
  },
  {
    id: 'tc',
    name: 'Visa',
    institutionId: 'custom',
    institutionName: 'Banco Popular',
    kind: 'credit_card',
    balance: -700000,
    initialBalance: -500000,
    creditLimit: 3000000,
    statementDay: 15,
    paymentDueDay: 30,
    currency: 'COP',
    createdAt: '2026-11-01',
    method: 'manual',
    isActive: true,
    color: 'gold',
    icon: 'creditcard.fill',
  },
];

const categories: Category[] = [
  { id: 'food', name: 'Alimentación', kind: 'expense', icon: 'fork.knife', tone: 'gold', slug: 'food', isDefault: true },
  { id: 'salary', name: 'Salario', kind: 'income', icon: 'briefcase.fill', tone: 'forest', slug: 'salary', isDefault: true },
  { id: 'pets', name: 'Mascotas', kind: 'expense', icon: 'pawprint.fill', tone: 'amber', isDefault: false },
];

const transactions: Transaction[] = [
  { id: 't1', type: 'income', amount: 200000, accountId: 'bc', categoryId: 'salary', description: 'Nómina', counterparty: 'Empresa', date: '2026-11-10' },
  { id: 't2', type: 'expense', amount: 150000, accountId: 'bc', categoryId: 'food', description: 'Mercado', date: '2026-11-09' },
  { id: 't3', type: 'transfer', amount: 200000, accountId: 'bc', toAccountId: 'nq', description: 'Recarga', date: '2026-11-08' },
  { id: 't4', type: 'adjustment', amount: 12345, adjustmentSign: -1, accountId: 'bc', description: 'Ajuste de saldo', notes: 'Comisión', date: '2026-11-07' },
  { id: 't5', type: 'expense', amount: 200000, accountId: 'tc', categoryId: 'food', description: 'Compra tarjeta', date: '2026-11-06' },
];
const voided: Transaction = {
  id: 't6',
  type: 'expense',
  amount: 50000,
  accountId: 'bc',
  categoryId: 'food',
  description: 'Taxi',
  date: '2026-11-05',
  voidedAt: '2026-11-05T12:00:00Z',
  voidReason: 'Error',
};

jest.mock('@/features/data/FinanceDataProvider', () => {
  const noop = jest.fn(async () => undefined);
  const byId = <T extends { id: string }>(list: T[]) => (id: string | undefined) => list.find((item) => item.id === id);
  return {
    useFinanceData: () => ({
      mode: 'live',
      setMode: jest.fn(),
      status: 'ready',
      error: null,
      accounts,
      activeAccounts: accounts,
      categories,
      transactions,
      voidedTransactions: [voided],
      summary: {
        available: 2500000,
        banks: 1800000,
        wallets: 700000,
        cash: 0,
        invested: 0,
        other: 0,
        cardDebt: 700000,
        creditLimit: 3000000,
        creditAvailable: 2300000,
        netWorth: 1800000,
        accounts: 3,
        monthStart: '2026-11-01',
        monthIncome: 200000,
        monthExpense: 350000,
      },
      getAccount: byId(accounts),
      getCategory: (id: string | undefined) =>
        categories.find((c) => c.id === id) ?? { id: 'transfer', name: 'Transferencia', kind: 'expense', icon: 'arrow.left.arrow.right', tone: 'stone' },
      getTransaction: byId([...transactions, voided]),
      reload: noop,
      createAccount: noop,
      updateAccount: noop,
      archiveAccount: noop,
      restoreAccount: noop,
      createTransaction: noop,
      updateTransaction: noop,
      voidTransaction: noop,
      reconcileAccount: noop,
      createCategory: noop,
      updateCategory: noop,
      setCategoryArchived: noop,
      deleteCategory: noop,
    }),
  };
});

import AccountsScreen from '@/app/(app)/(tabs)/accounts';
import TransactionsRoute from '@/app/(app)/(tabs)/transactions';
import AccountDetailScreen from '@/app/(app)/account/[id]';
import CardsRoute from '@/app/(app)/cards';
import CategoriesScreen from '@/app/(app)/categories';
import CategoryEditScreen from '@/app/(app)/category/edit';
import TransactionDetailScreen from '@/app/(app)/transaction/[id]';
import { AccountForm } from '@/features/accounts/AccountForm';
import { PrivacyProvider } from '@/features/privacy/PrivacyProvider';
import { TransactionForm } from '@/features/transactions/TransactionForm';
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

type Case = [name: string, element: () => ReactElement, params: Record<string, string>, expected: (string | RegExp)[], absent?: string[]];

const cases: Case[] = [
  ['Mis cuentas: totales del servidor y una tarjeta por cuenta', () => <AccountsScreen />, {}, ['Saldo total de cuentas', 'Deuda en tarjetas', 'Ahorros nómina', /Banco Popular/]],
  ['Detalle de cuenta: resumen, gráfico, movimientos y acciones', () => <AccountDetailScreen />, { id: 'bc' }, ['Resumen', 'Evolución del saldo', 'Ajustar saldo', 'Editar cuenta']],
  ['Detalle de tarjeta: cupo, disponible y fechas', () => <AccountDetailScreen />, { id: 'tc' }, ['Cupo de la tarjeta', 'Cupo disponible', 'Próximo corte', 'Pagar']],
  ['Nueva cuenta', () => <AccountForm />, {}, ['Ejemplos rápidos', 'Color identificador', 'Guardar cuenta']],
  ['Editar una tarjeta', () => <AccountForm account={accounts[2]} />, {}, ['Editar cuenta', 'Día límite de pago', 'Guardar cambios']],
  ['Nuevo gasto', () => <TransactionForm initialType="expense" />, {}, ['Guardar gasto', 'Comercio (opcional)']],
  ['Nuevo ingreso', () => <TransactionForm initialType="income" />, {}, ['Guardar ingreso', 'Persona o empresa de origen (opcional)']],
  ['Pago de tarjeta (transferencia)', () => <TransactionForm initialType="transfer" initialToAccountId="tc" />, {}, ['Guardar transferencia', /Pago de tarjeta/]],
  ['Ajuste de saldo', () => <TransactionForm initialType="adjustment" initialAccountId="bc" />, {}, ['Registrar ajuste', 'Saldo real hoy']],
  ['Editar un gasto', () => <TransactionForm transaction={transactions[1]} />, {}, ['Editar gasto', 'Guardar cambios']],
  ['Historial con búsqueda y filtros', () => <TransactionsRoute />, {}, ['Ajustes', 'Más filtros', 'Mercado']],
  ['Detalle de un movimiento', () => <TransactionDetailScreen />, { id: 't2' }, ['Editar movimiento', 'Anular movimiento']],
  ['Detalle de un movimiento anulado', () => <TransactionDetailScreen />, { id: 't6' }, ['Anulado'], ['Editar movimiento']],
  ['Tarjetas de crédito con datos reales', () => <CardsRoute />, {}, ['Deuda pendiente total', 'Fecha límite de pago']],
  ['Categorías', () => <CategoriesScreen />, {}, ['Tus categorías', 'Predeterminadas', 'Mascotas']],
  ['Editar una categoría propia', () => <CategoryEditScreen />, { id: 'pets' }, ['Editar categoría', 'Archivar categoría']],
];

describe('Pantallas de la Fase 4 (se dibujan con datos reales de ejemplo)', () => {
  it.each(cases)('%s', async (_name, element, params, expected, absent = []) => {
    await show(element(), params);
    for (const text of expected) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const text of absent) expect(screen.queryByText(text)).toBeNull();
  });
});
