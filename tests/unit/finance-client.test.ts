/**
 * Lógica de la Fase 4 en la app (los saldos reales los calcula PostgreSQL; aquí
 * se prueba lo que la app decide sola): filtros y búsqueda del historial,
 * cifras de tarjeta, fechas de corte, validaciones, gráfico y resumen de demo.
 */
import { cardDebt, cardMetrics, institutionOf, nextDayOfMonth } from '@/features/accounts/display';
import { sampleHistory } from '@/features/accounts/history';
import { validateAccountDraft, type AccountDraft } from '@/features/accounts/validation';
import { summaryFromAccounts } from '@/features/data/summaries';
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  groupByMonthAndDay,
  normalizeText,
} from '@/features/transactions/filters';
import { reconcileDifference, validateTransactionDraft, type TransactionDraft } from '@/features/transactions/validation';
import type { Account, Transaction } from '@/types/finance';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));

const account = (overrides: Partial<Account>): Account => ({
  id: 'acc',
  name: 'Cuenta',
  institutionId: 'bancolombia',
  kind: 'savings',
  balance: 0,
  initialBalance: 0,
  currency: 'COP',
  createdAt: '2026-11-01',
  method: 'manual',
  isActive: true,
  ...overrides,
});

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 10000,
  accountId: 'bancolombia',
  categoryId: 'food',
  description: '',
  date: '2026-11-10',
  ...overrides,
});

describe('Tarjetas de crédito', () => {
  it('CASO 4: cupo 3.000.000 y deuda 700.000 → disponible 2.300.000', () => {
    const card = account({ kind: 'credit_card', balance: -700000, creditLimit: 3000000 });
    expect(cardDebt(card)).toBe(700000);
    expect(cardMetrics(card)).toEqual({ limit: 3000000, debt: 700000, available: 2300000, utilization: 700000 / 3000000 });
  });

  it('sin deuda (o con saldo a favor) la deuda es 0 y el disponible no pasa del cupo más el saldo a favor', () => {
    expect(cardDebt(account({ kind: 'credit_card', balance: 0 }))).toBe(0);
    expect(cardMetrics(account({ kind: 'credit_card', balance: 50000, creditLimit: 1000000 }))?.available).toBe(1050000);
  });

  it('si la deuda supera el cupo, el disponible es 0 (no negativo)', () => {
    expect(cardMetrics(account({ kind: 'credit_card', balance: -1200000, creditLimit: 1000000 }))?.available).toBe(0);
  });

  it('próxima fecha de corte o pago: este mes, el siguiente, fin de mes y cambio de año', () => {
    expect(nextDayOfMonth(15, '2026-11-11')).toBe('2026-11-15');
    expect(nextDayOfMonth(5, '2026-11-11')).toBe('2026-12-05');
    expect(nextDayOfMonth(31, '2027-02-10')).toBe('2027-02-28');
    expect(nextDayOfMonth(10, '2026-12-20')).toBe('2027-01-10');
    expect(nextDayOfMonth(11, '2026-11-11')).toBe('2026-11-11');
  });
});

describe('Identificador visual de la cuenta', () => {
  it('entidad escrita a mano: su nombre e iniciales', () => {
    const badge = institutionOf({ institutionId: 'custom', institutionName: 'Banco Popular', color: null, icon: null });
    expect(badge.name).toBe('Banco Popular');
    expect(badge.initials).toBe('BP');
    expect(badge.icon).toBeUndefined();
  });

  it('respeta el color y el ícono elegidos', () => {
    const badge = institutionOf({ institutionId: 'nequi', institutionName: null, color: 'gold', icon: 'iphone' });
    expect(badge).toMatchObject({ name: 'Nequi', tone: 'gold', icon: 'iphone' });
  });

  it('un color que no es de la paleta se ignora', () => {
    expect(institutionOf({ institutionId: 'nequi', color: '#FF0000', icon: null }).tone).toBe('plum');
  });
});

describe('Validación de cuentas', () => {
  const base: AccountDraft = {
    name: 'Ahorros',
    institution: 'bancolombia',
    institutionName: '',
    kind: 'savings',
    initial: 0,
    creditLimit: 0,
    statementDay: null,
    paymentDueDay: null,
    lastFour: '',
    description: '',
  };

  it('una cuenta con saldo inicial cero es válida', () => {
    expect(validateAccountDraft(base)).toEqual({});
  });

  it('pide nombre, entidad personalizada, tipo y cupo de tarjeta', () => {
    expect(validateAccountDraft({ ...base, name: ' ' }).name).toBeDefined();
    expect(validateAccountDraft({ ...base, institution: 'custom', institutionName: '' }).institutionName).toBeDefined();
    expect(validateAccountDraft({ ...base, kind: null }).kind).toBeDefined();
    expect(validateAccountDraft({ ...base, kind: 'credit_card', creditLimit: 0 }).creditLimit).toBeDefined();
    expect(validateAccountDraft({ ...base, kind: 'credit_card', creditLimit: 3000000 })).toEqual({});
  });

  it('los últimos 4 dígitos son exactamente 4 números', () => {
    expect(validateAccountDraft({ ...base, lastFour: '12' }).lastFour).toBeDefined();
    expect(validateAccountDraft({ ...base, lastFour: '1234' })).toEqual({});
  });
});

describe('Validación de movimientos', () => {
  const base: TransactionDraft = {
    type: 'expense',
    amount: 15000,
    accountId: 'a',
    toAccountId: null,
    categoryId: 'food',
    description: '',
    counterparty: '',
    date: '2026-11-11',
    notes: '',
  };

  it('un gasto completo es válido', () => {
    expect(validateTransactionDraft(base, '2026-11-11')).toEqual({});
  });

  it('monto en cero, sin cuenta o sin categoría', () => {
    expect(validateTransactionDraft({ ...base, amount: 0 }, '2026-11-11').amount).toBeDefined();
    expect(validateTransactionDraft({ ...base, accountId: null }, '2026-11-11').accountId).toBeDefined();
    expect(validateTransactionDraft({ ...base, categoryId: null }, '2026-11-11').categoryId).toBeDefined();
  });

  it('transferencia: necesita destino y distinto del origen; no lleva categoría', () => {
    const transfer = { ...base, type: 'transfer' as const, categoryId: null };
    expect(validateTransactionDraft({ ...transfer, toAccountId: null }, '2026-11-11').toAccountId).toBeDefined();
    expect(validateTransactionDraft({ ...transfer, toAccountId: 'a' }, '2026-11-11').toAccountId).toMatch(/distintas/);
    expect(validateTransactionDraft({ ...transfer, toAccountId: 'b' }, '2026-11-11')).toEqual({});
  });

  it('no acepta fechas futuras', () => {
    expect(validateTransactionDraft({ ...base, date: '2026-11-12' }, '2026-11-11').date).toBeDefined();
  });
});

describe('Ajuste de saldo', () => {
  it('la diferencia es saldo real − saldo calculado', () => {
    expect(reconcileDifference(987655, 1000000)).toBe(-12345);
    expect(reconcileDifference(1000000, 1000000)).toBe(0);
    // Tarjeta: saldo = −deuda. Deuda real 520.000 frente a 500.000 calculada → −20.000.
    expect(reconcileDifference(-520000, -500000)).toBe(-20000);
  });
});

describe('Historial: filtros, búsqueda y agrupación', () => {
  const list: Transaction[] = [
    tx({ id: '1', date: '2026-11-10', type: 'expense', amount: 80000, description: 'Mercado', counterparty: 'Éxito', categoryId: 'food' }),
    tx({ id: '2', date: '2026-11-10', type: 'income', amount: 2500000, description: 'Nómina', categoryId: 'salary' }),
    tx({ id: '3', date: '2026-11-02', type: 'transfer', amount: 200000, accountId: 'bancolombia', toAccountId: 'nequi', categoryId: undefined }),
    tx({ id: '4', date: '2026-10-28', type: 'adjustment', amount: 12345, adjustmentSign: -1, categoryId: undefined }),
    tx({ id: '5', date: '2026-10-20', type: 'expense', amount: 50000, description: 'Taxi', voidedAt: '2026-10-21T10:00:00Z' }),
  ];

  it('sin filtros oculta los anulados', () => {
    expect(applyFilters(list, EMPTY_FILTERS).map((t) => t.id)).toEqual(['1', '2', '3', '4']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, includeVoided: true })).toHaveLength(5);
  });

  it('por tipo, incluidos ajustes', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, type: 'adjustment' }).map((t) => t.id)).toEqual(['4']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, type: 'transfer' }).map((t) => t.id)).toEqual(['3']);
  });

  it('por cuenta: también encuentra las transferencias que llegan a ella', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, accountId: 'nequi' }).map((t) => t.id)).toEqual(['3']);
  });

  it('por fechas y por valor mínimo y máximo', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, from: '2026-11-01', to: '2026-11-30' }).map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, min: 50000, max: 300000 }).map((t) => t.id)).toEqual(['1', '3']);
  });

  it('búsqueda por descripción o comercio, sin importar tildes ni mayúsculas', () => {
    expect(normalizeText(' Éxito ')).toBe('exito');
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'exito' }).map((t) => t.id)).toEqual(['1']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'NOMINA' }).map((t) => t.id)).toEqual(['2']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'mercado exito' }).map((t) => t.id)).toEqual(['1']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'mercado taxi' })).toHaveLength(0);
  });

  it('agrupa por mes y por día, del más reciente al más antiguo', () => {
    const groups = groupByMonthAndDay(applyFilters(list, EMPTY_FILTERS));
    expect(groups.map((g) => g.month)).toEqual(['2026-11', '2026-10']);
    expect(groups[0]!.days.map((d) => [d.date, d.data.length])).toEqual([
      ['2026-11-10', 2],
      ['2026-11-02', 1],
    ]);
  });

  it('cuenta los filtros activos', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, type: 'income', search: 'x', min: 1 })).toBe(3);
  });
});

describe('Gráfico de evolución del saldo', () => {
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    balance: 1000000 + index * 1000,
  }));

  it('resume a pocos puntos y conserva el primero y el último (saldo de hoy)', () => {
    const points = sampleHistory(days, 'month');
    expect(points.length).toBeLessThanOrEqual(10);
    expect(points[0]!.date).toBe('2026-11-01');
    expect(points[points.length - 1]!.balance).toBe(1029000);
  });

  it('una semana se muestra día por día', () => {
    expect(sampleHistory(days.slice(0, 7), 'week')).toHaveLength(7);
  });
});

describe('Resumen financiero (misma regla que financial_summary)', () => {
  it('CASOS 3, 4 y 5: transferencias y pago de tarjeta no duplican; el cupo no suma', () => {
    const accounts = [
      account({ id: 'b', kind: 'savings', balance: 1800000 }),
      account({ id: 'n', kind: 'digital_wallet', balance: 700000 }),
      account({ id: 'c', kind: 'cash', balance: 790000 }),
      account({ id: 'd', kind: 'cdt', balance: 2000000 }),
      account({ id: 't', kind: 'credit_card', balance: -500000, creditLimit: 3000000 }),
      account({ id: 'x', kind: 'savings', balance: 999999, isActive: false }),
    ];
    const summary = summaryFromAccounts(accounts, [], '2026-11');
    expect(summary).toMatchObject({
      banks: 1800000,
      wallets: 700000,
      cash: 790000,
      available: 3290000,
      invested: 2000000,
      cardDebt: 500000,
      creditLimit: 3000000,
      creditAvailable: 2500000,
      netWorth: 1800000 + 700000 + 790000 + 2000000 - 500000,
      accounts: 5,
    });
  });
});
