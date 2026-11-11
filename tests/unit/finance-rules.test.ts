import { accountsOverview, groupByDay, signedAmountFor, totalsOf } from '@/features/data/summaries';
import { formatAmountInput, formatCompact, formatMoney, formatPercent, fromDb, parseAmountInput } from '@/lib/money';
import type { Account, Transaction } from '@/types/finance';

const account = (id: string, kind: Account['kind'], balance: number): Account => ({
  id,
  name: id,
  institutionId: 'custom',
  kind,
  balance,
  initialBalance: 0,
  currency: 'COP',
  createdAt: '2026-11-01',
  method: 'manual',
  isActive: true,
});

const tx = (partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount'>): Transaction => ({
  accountId: 'ahorros',
  description: '',
  date: '2026-11-10',
  ...partial,
});

describe('Formato de pesos colombianos', () => {
  it('usa punto de miles, sin decimales y espacio no separable', () => {
    expect(formatMoney(1250000)).toBe('$ 1.250.000');
    expect(formatMoney(-186400)).toBe('−$ 186.400');
    expect(formatMoney(300000, { sign: 'always' })).toBe('+$ 300.000');
    expect(formatMoney(5, { hidden: true })).toBe('$ ••••••');
  });

  it('formatos cortos y porcentajes', () => {
    expect(formatCompact(2500000)).toBe('2,5 M');
    expect(formatCompact(1250000)).toBe('1,25 M');
    expect(formatCompact(850000)).toBe('850 mil');
    expect(formatPercent(6.4)).toBe('6,4 %');
    expect(formatPercent(40.62, { sign: true })).toBe('+40,6 %');
  });

  it('lee lo que escribe el usuario y lo que devuelve PostgreSQL', () => {
    expect(parseAmountInput('1.250.000')).toBe(1250000);
    expect(parseAmountInput('abc')).toBe(0);
    expect(formatAmountInput(1250000)).toBe('1.250.000');
    expect(fromDb('5200000')).toBe(5200000);
    expect(fromDb(null)).toBe(0);
    expect(() => fromDb('99999999999999999999')).toThrow();
  });
});

describe('Reglas contables', () => {
  const transactions: Transaction[] = [
    tx({ id: '1', type: 'income', amount: 2500000, categoryId: 'salary' }),
    tx({ id: '2', type: 'transfer', amount: 300000, toAccountId: 'nequi' }),
    tx({ id: '3', type: 'expense', amount: 400000, accountId: 'tarjeta', categoryId: 'tech' }),
    tx({ id: '4', type: 'transfer', amount: 150000, toAccountId: 'tarjeta', date: '2026-11-09' }),
    tx({ id: '5', type: 'adjustment', amount: 50000, adjustmentSign: -1, date: '2026-11-09' }),
  ];

  it('transferencias, pagos de tarjeta y ajustes no son ingreso ni gasto', () => {
    expect(totalsOf(transactions)).toEqual({ income: 2500000, expense: 400000, balance: 2100000 });
  });

  it('cada movimiento afecta a cada cuenta una sola vez', () => {
    const transfer = transactions[1]!;
    expect(signedAmountFor(transfer, 'ahorros')).toBe(-300000);
    expect(signedAmountFor(transfer, 'nequi')).toBe(300000);
    expect(signedAmountFor(transactions[4]!, 'ahorros')).toBe(-50000);
  });

  it('el patrimonio suma cada cuenta una vez y la tarjeta cuenta como deuda', () => {
    const overview = accountsOverview([
      account('ahorros', 'savings', 3000000),
      account('nequi', 'digital_wallet', 420000),
      account('cdt', 'investment', 2000000),
      account('tarjeta', 'credit_card', -250000),
    ]);
    expect(overview).toEqual({ available: 3420000, investments: 2000000, debts: 250000, netWorth: 5170000 });
  });

  it('las cuentas archivadas no suman', () => {
    const archived = { ...account('vieja', 'savings', 999), isActive: false };
    expect(accountsOverview([archived]).netWorth).toBe(0);
  });

  it('agrupa por día conservando el orden', () => {
    const groups = groupByDay(transactions);
    expect(groups.map((group) => group.date)).toEqual(['2026-11-10', '2026-11-09']);
    expect(groups[0]!.data).toHaveLength(3);
  });
});
