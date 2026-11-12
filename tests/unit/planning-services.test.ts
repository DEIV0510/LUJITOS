/**
 * Servicios de la Fase 5 con Supabase simulado: qué se envía a cada función
 * RPC, cómo se leen las vistas (presupuesto, meta, deuda, planificación), cómo
 * se traducen los códigos LJ010–LJ013 y la confirmación de un sobrepago.
 */
const mockRpc = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('react-native', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));

import { runWithConfirmations } from '@/features/finance/confirmations';
import { financeFailure } from '@/services/finance/errors';
import { parseSummary } from '@/services/finance/financeService';
import { createBudget } from '@/services/planning/budgetService';
import { createDebt, registerDebtPayment } from '@/services/planning/debtService';
import { addGoalMovement } from '@/services/planning/goalService';
import { mapBudget, mapDebt, mapGoal, parsePlanning } from '@/services/planning/mappers';
import type { BudgetRow, BudgetStatusRow, DebtOverviewRow, DebtRow, SavingsGoalProgressRow, SavingsGoalRow } from '@/types/database';
import type { Account } from '@/types/finance';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('Envío a las funciones RPC', () => {
  it('presupuesto general: categoría nula, avisos y nombre vacío como null', async () => {
    mockRpc.mockResolvedValue({ data: 'b1', error: null });
    await createBudget(
      { categoryId: null, limit: 2000000, period: 'monthly', startDate: '2026-11-01', endDate: null, name: '  ', thresholds: [50, 100] },
      'req-b',
    );
    expect(mockRpc).toHaveBeenCalledWith('create_budget', {
      p_category_id: null,
      p_limit_amount: 2000000,
      p_period: 'monthly',
      p_start_date: '2026-11-01',
      p_end_date: null,
      p_name: null,
      p_alert_thresholds: [50, 100],
      p_request_id: 'req-b',
    });
  });

  it('aporte sin cuenta: solo asignación (sin transferencia)', async () => {
    mockRpc.mockResolvedValue({ data: 'm1', error: null });
    await addGoalMovement({ goalId: 'g1', kind: 'contribution', amount: 500000, date: '2026-11-12' }, 'req-g');
    expect(mockRpc).toHaveBeenCalledWith('add_goal_movement', {
      p_goal_id: 'g1',
      p_kind: 'contribution',
      p_amount: 500000,
      p_movement_date: '2026-11-12',
      p_note: null,
      p_account_id: null,
      p_request_id: 'req-g',
      p_allow_negative: false,
    });
  });

  it('deuda sin cuotas fijas ni interés: sin fecha de cuota ni periodo de tasa', async () => {
    mockRpc.mockResolvedValue({ data: 'd1', error: null });
    await createDebt(
      {
        name: 'Préstamo de Ana',
        kind: 'personal',
        creditor: ' Ana ',
        originalAmount: 200000,
        outstanding: 200000,
        interestRate: null,
        interestPeriod: 'monthly',
        startDate: '2026-11-12',
        dueDate: null,
        installment: null,
        frequency: 'none',
        firstPaymentDate: '2026-12-01',
        paymentAccountId: null,
      },
      'req-d',
    );
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({
      p_creditor: 'Ana',
      p_interest_rate: null,
      p_interest_period: null,
      p_first_payment_date: null,
      p_outstanding: 200000,
      p_request_id: 'req-d',
    });
  });

  it('cuota con intereses y pago de interés: cada uno envía lo suyo', async () => {
    mockRpc.mockResolvedValue({ data: { transaction_id: 't1', interest_transaction_id: 't0' }, error: null });
    const result = await registerDebtPayment(
      { debtId: 'd1', kind: 'installment', amount: 500000, accountId: 'bank', interestPortion: 100000, date: '2026-11-12' },
      'req-p',
    );
    expect(result).toEqual({ transactionId: 't1', interestTransactionId: 't0' });
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_kind: 'installment', p_account_id: 'bank', p_interest_portion: 100000, p_allow_overpay: false });

    await registerDebtPayment({ debtId: 'd1', kind: 'interest', amount: 80000, accountId: 'bank', interestPortion: 5, date: '2026-11-12' }, 'req-i');
    expect(mockRpc.mock.calls[1]![1]).toMatchObject({ p_kind: 'interest', p_account_id: null, p_interest_portion: 0 });
  });
});

describe('Códigos del servidor', () => {
  it('LJ010–LJ013 se traducen y conservan el mensaje del servidor', () => {
    expect(financeFailure('x', { code: 'LJ010', message: 'No puedes retirar más de lo ahorrado en la meta.' }).code).toBe('goal_below_zero');
    expect(financeFailure('x', { code: 'LJ011', message: 'El pago supera lo que debes.', details: '4500000' }).detailAmount).toBe(4500000);
    expect(financeFailure('x', { code: 'LJ012', message: 'Ya tienes un presupuesto activo.' }).code).toBe('duplicate_budget');
    expect(financeFailure('x', { code: 'LJ013', message: 'Tiene historial.' }).code).toBe('has_history');
  });

  it('un sobrepago se confirma y se repite con permiso de sobrepago', async () => {
    mockAlert.mockImplementationOnce((_t: string, _m: string, buttons: { text: string; onPress?: () => void }[]) => {
      buttons.find((button) => button.text === 'Pagar igual')?.onPress?.();
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(financeFailure('x', { code: 'LJ011', message: 'El pago supera lo que debes.', details: '4500000' }))
      .mockResolvedValueOnce('ok');
    await expect(runWithConfirmations(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenLastCalledWith({ allowOverpay: true });
    expect(mockAlert.mock.calls[0]![1]).toContain('4.500.000');
  });

  it('si el usuario cancela el sobrepago no se repite', async () => {
    mockAlert.mockImplementationOnce((_t: string, _m: string, buttons: { text: string; onPress?: () => void }[]) => {
      buttons.find((button) => button.text === 'Cancelar')?.onPress?.();
    });
    const operation = jest.fn().mockRejectedValue(financeFailure('x', { code: 'LJ011', message: 'Supera', details: '1' }));
    await expect(runWithConfirmations(operation)).resolves.toBeNull();
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('Lectura de vistas', () => {
  const stamps = { created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z' };

  it('presupuesto: gastado, disponible y % vienen del servidor', () => {
    const row: BudgetRow = {
      ...stamps,
      id: 'b1',
      user_id: 'u',
      category_id: 'food',
      name: null,
      limit_amount: 500000,
      period: 'monthly',
      start_date: '2026-11-01',
      end_date: null,
      alert_thresholds: [90, 50, 75, 100],
      archived_at: null,
      client_request_id: null,
    };
    const status: BudgetStatusRow = {
      budget_id: 'b1',
      user_id: 'u',
      period_start: '2026-11-01',
      period_end: '2026-11-30',
      limit_amount: 500000,
      spent: 250000,
      available: 250000,
      percent_used: 50,
      status: 'active',
      days_left: 18,
      previous_period_start: '2026-10-01',
      previous_spent: 80000,
    };
    expect(mapBudget(row, status)).toMatchObject({ spent: 250000, available: 250000, percentUsed: 50, state: 'active', thresholds: [50, 75, 90, 100], previousSpent: 80000 });
  });

  it('meta: 31,25 % y recomendación nula cuando no aplica', () => {
    const row: SavingsGoalRow = {
      ...stamps,
      id: 'g1',
      user_id: 'u',
      name: 'Viaje',
      description: null,
      kind: 'travel',
      target_amount: 8000000,
      initial_saved: 2000000,
      start_date: '2026-11-12',
      target_date: null,
      account_id: null,
      color: null,
      icon: null,
      archived_at: null,
      client_request_id: null,
    };
    const progress: SavingsGoalProgressRow = {
      goal_id: 'g1',
      user_id: 'u',
      saved: 2500000,
      contributed: 500000,
      withdrawn: 0,
      remaining: 5500000,
      percent: 31.25,
      exceeded_by: 0,
      days_left: null,
      status: 'active',
      monthly_needed: null,
      weekly_needed: null,
      daily_needed: null,
      unassigned: true,
      account_balance: null,
      account_allocated: null,
      movement_count: 1,
      last_movement_date: '2026-11-12',
    };
    expect(mapGoal(row, progress)).toMatchObject({ saved: 2500000, remaining: 5500000, percent: 31.25, monthlyNeeded: null, unassigned: true, kind: 'travel' });
  });

  it('deuda: nombre y estado de su cuenta; seguimiento de la vista', () => {
    const row: DebtRow = {
      ...stamps,
      id: 'd1',
      user_id: 'u',
      account_id: 'loan1',
      kind: 'vehicle',
      creditor: 'Banco de Bogotá',
      original_amount: 5000000,
      interest_rate: 1.5,
      interest_period: 'monthly',
      start_date: '2026-11-12',
      due_date: null,
      installment_amount: 500000,
      frequency: 'monthly',
      first_payment_date: '2026-11-12',
      payment_account_id: 'bank',
      description: null,
      client_request_id: null,
    };
    const overview: DebtOverviewRow = {
      debt_id: 'd1',
      user_id: 'u',
      account_id: 'loan1',
      outstanding: 4500000,
      credit_balance: 0,
      initial_outstanding: 5000000,
      paid_before: 0,
      total_paid: 500000,
      installments_paid: 1,
      interest_registered: 0,
      disbursed: 0,
      last_payment_date: '2026-11-12',
      percent_paid: 10,
      next_payment_date: '2026-12-12',
      days_to_next_payment: 30,
      days_to_due: null,
      status: 'active',
    };
    const account = { id: 'loan1', name: 'Crédito carro', color: 'rose', isActive: true } as Account;
    expect(mapDebt(row, overview, account)).toMatchObject({
      name: 'Crédito carro',
      outstanding: 4500000,
      totalPaid: 500000,
      percentPaid: 10,
      interestRate: 1.5,
      nextPaymentDate: '2026-12-12',
      state: 'active',
    });
  });

  it('planificación: vacía sin datos y % de ahorro nulo sin ingresos', () => {
    expect(parsePlanning({ basis: 'none', months_used: 0, preliminary: true, income_avg: null, savings_rate: null, obligations_monthly: 0 })).toMatchObject({
      basis: 'none',
      preliminary: true,
      incomeAvg: null,
      savingsRate: null,
      savingsCapacity: null,
    });
    expect(parsePlanning({ basis: 'current_month', months_used: 0, preliminary: true, savings_capacity: 800000, savings_rate: 26.67 })).toMatchObject({
      savingsCapacity: 800000,
      savingsRate: 26.67,
    });
  });

  it('resumen: activos, pasivos, deudas y % de ahorro', () => {
    const summary = parseSummary({
      net_worth: 7000000,
      assets: 10000000,
      liabilities: 3000000,
      card_debt: 500000,
      loan_debt: 2500000,
      total_debt: 3000000,
      month_income: 0,
      month_expense: 0,
      savings_rate: null,
    });
    expect(summary).toMatchObject({ assets: 10000000, liabilities: 3000000, netWorth: 7000000, totalDebt: 3000000, savingsRate: null });
  });
});
