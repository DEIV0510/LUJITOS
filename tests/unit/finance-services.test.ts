/**
 * Servicios de la Fase 4 con Supabase simulado: qué se envía a cada función RPC,
 * cómo se traducen los errores del motor y cómo se resuelven las advertencias
 * (saldo negativo, cupo, transferencia repetida) con el usuario.
 */
const mockRpc = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));
jest.mock('react-native', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));

import { runWithConfirmations } from '@/features/finance/confirmations';
import { createAccount } from '@/services/accounts/accountService';
import { FinanceError, financeFailure } from '@/services/finance/errors';
import { parseSummary } from '@/services/finance/financeService';
import { createTransaction, reconcileAccount } from '@/services/transactions/transactionService';

/** El usuario responde la alerta con el botón indicado. */
function answer(label: 'Cancelar' | 'Registrar igual' | 'Sí, registrar otra') {
  mockAlert.mockImplementationOnce((_title: string, _message: string, buttons: { text: string; onPress?: () => void }[]) => {
    buttons.find((button) => button.text === label)?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('Envío a las funciones RPC', () => {
  it('un gasto envía comercio y categoría; nunca destino', async () => {
    mockRpc.mockResolvedValue({ data: 'tx-1', error: null });
    await createTransaction(
      { type: 'expense', amount: 15000, accountId: 'a', toAccountId: 'b', categoryId: 'food', date: '2026-11-11', description: ' Mercado ', counterparty: ' Éxito ' },
      'req-1',
    );
    expect(mockRpc).toHaveBeenCalledWith('create_transaction', {
      p_type: 'expense',
      p_amount: 15000,
      p_account_id: 'a',
      p_destination_account_id: null,
      p_category_id: 'food',
      p_transaction_date: '2026-11-11',
      p_description: 'Mercado',
      p_merchant: 'Éxito',
      p_notes: null,
      p_request_id: 'req-1',
      p_allow_negative: false,
      p_allow_duplicate: false,
    });
  });

  it('una transferencia envía destino y nunca categoría ni comercio', async () => {
    mockRpc.mockResolvedValue({ data: 'tx-2', error: null });
    await createTransaction(
      { type: 'transfer', amount: 200000, accountId: 'a', toAccountId: 'b', categoryId: 'food', date: '2026-11-11', description: 'Recarga', counterparty: 'x' },
      'req-2',
    );
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_destination_account_id: 'b', p_category_id: null, p_merchant: null });
  });

  it('una tarjeta guarda deuda (negativa), cupo y días; otra cuenta no los envía', async () => {
    mockRpc.mockResolvedValue({ data: 'acc-1', error: null });
    await createAccount(
      { name: 'Visa', kind: 'credit_card', institution: 'bancolombia', initialBalance: -500000, creditLimit: 3000000, statementDay: 15, paymentDueDay: 30 },
      'req-3',
    );
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_initial_balance: -500000, p_credit_limit: 3000000, p_statement_day: 15, p_payment_due_day: 30 });
    await createAccount(
      { name: 'Ahorros', kind: 'savings', institution: 'custom', institutionName: ' Banco Popular ', initialBalance: 0, creditLimit: 9, statementDay: 1 },
      'req-4',
    );
    expect(mockRpc.mock.calls[1]![1]).toMatchObject({ p_institution_name: 'Banco Popular', p_credit_limit: null, p_statement_day: null });
  });

  it('el ajuste envía el saldo real, el esperado y el motivo; devuelve la diferencia', async () => {
    mockRpc.mockResolvedValue({ data: { transaction_id: 't', difference: -12345 }, error: null });
    const result = await reconcileAccount({ accountId: 'a', observedBalance: 987655, expectedBalance: 1000000, reason: ' Comisión ' }, 'req-5');
    expect(mockRpc).toHaveBeenCalledWith('reconcile_account', {
      p_account_id: 'a',
      p_observed_balance: 987655,
      p_expected_balance: 1000000,
      p_reason: 'Comisión',
      p_request_id: 'req-5',
    });
    expect(result).toEqual({ transactionId: 't', difference: -12345 });
  });

  it('lee el resumen del servidor (BIGINT puede llegar como texto)', () => {
    expect(parseSummary({ available: '5290000', card_debt: 500000, net_worth: '6790000', accounts: 6, month_start: '2026-11-01' })).toMatchObject({
      available: 5290000,
      cardDebt: 500000,
      netWorth: 6790000,
      accounts: 6,
      invested: 0,
    });
  });
});

describe('Errores del motor financiero', () => {
  it('traduce los códigos LJ y conserva el detalle numérico', () => {
    const error = financeFailure('prueba', { code: 'LJ001', message: 'El saldo de «Nequi» quedaría negativo.', details: '-25000' });
    expect(error).toBeInstanceOf(FinanceError);
    expect(error.code).toBe('insufficient_funds');
    expect(error.detailAmount).toBe(-25000);
    expect(error.message).toBe('El saldo de «Nequi» quedaría negativo.');
  });

  it('un error desconocido no muestra el mensaje técnico', () => {
    const error = financeFailure('prueba', { code: 'XX000', message: 'internal: relation foo does not exist' });
    expect(error.code).toBe('unknown');
    expect(error.message).not.toMatch(/relation|internal/);
  });
});

describe('Advertencias que el usuario confirma', () => {
  const insufficient = () => new FinanceError('El saldo de «Efectivo» quedaría negativo.', 'insufficient_funds', '-210000');

  it('si el usuario acepta, se repite con permiso para saldo negativo', async () => {
    answer('Registrar igual');
    const operation = jest.fn().mockRejectedValueOnce(insufficient()).mockResolvedValueOnce('ok');
    await expect(runWithConfirmations(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenNthCalledWith(2, { allowNegative: true });
    expect(mockAlert.mock.calls[0]![1]).toContain('−$ 210.000');
  });

  it('si el usuario cancela, no se guarda nada', async () => {
    answer('Cancelar');
    const operation = jest.fn().mockRejectedValueOnce(insufficient());
    await expect(runWithConfirmations(operation)).resolves.toBeNull();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('transferencia repetida: se confirma por separado', async () => {
    answer('Sí, registrar otra');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new FinanceError('Ya registraste esta misma transferencia hace un momento.', 'duplicate_transfer', null))
      .mockResolvedValueOnce('ok');
    await expect(runWithConfirmations(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenNthCalledWith(2, { allowDuplicate: true });
  });

  it('los demás errores no se preguntan: se muestran', async () => {
    const operation = jest.fn().mockRejectedValueOnce(new FinanceError('La cuenta no existe o no es tuya.', 'not_found', null));
    await expect(runWithConfirmations(operation)).rejects.toThrow('no es tuya');
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
