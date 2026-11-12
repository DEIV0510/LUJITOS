/**
 * Advertencias del motor financiero que el usuario puede aceptar:
 *   saldo que quedaría negativo, compra que supera el cupo, transferencia
 *   repetida hace un momento y archivar una cuenta con saldo.
 * La operación se intenta; si el servidor advierte, se pregunta y, solo si el
 * usuario acepta, se repite con el permiso correspondiente.
 */
import { Alert } from 'react-native';

import { formatMoney } from '@/lib/money';
import { isFinanceError, type FinanceError } from '@/services/finance/errors';
import type { WriteOptions } from '@/services/transactions/transactionService';

function ask(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

export function confirmWarning(error: FinanceError): Promise<boolean> {
  const amount = error.detailAmount;
  switch (error.code) {
    case 'insufficient_funds':
      return ask(
        'Saldo insuficiente',
        `${error.message}${amount !== null ? ` Quedaría en ${formatMoney(amount)}.` : ''} ¿Lo registras de todas formas?`,
        'Registrar igual',
      );
    case 'over_credit_limit':
      return ask(
        'Supera el cupo',
        `${error.message}${amount !== null ? ` Cupo disponible: ${formatMoney(amount)}.` : ''} ¿Lo registras de todas formas?`,
        'Registrar igual',
      );
    case 'duplicate_transfer':
      return ask('¿Transferencia repetida?', `${error.message} ¿Quieres registrar otra igual?`, 'Sí, registrar otra');
    case 'account_has_balance':
      return ask(
        'La cuenta tiene saldo',
        `${amount !== null ? `Tiene ${formatMoney(amount)}. ` : ''}${error.message} Si ya no la usas, primero transfiere o ajusta el saldo a cero.`,
        'Archivar igual',
      );
    default:
      return Promise.resolve(false);
  }
}

/**
 * Ejecuta una escritura y resuelve las advertencias con el usuario.
 * Devuelve null si el usuario canceló. Los demás errores se propagan.
 */
export async function runWithConfirmations<T>(operation: (options: WriteOptions) => Promise<T>): Promise<T | null> {
  const options: WriteOptions = {};
  // Como mucho: una advertencia de saldo/cupo y una de transferencia repetida.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation({ ...options });
    } catch (error) {
      if (isFinanceError(error, 'insufficient_funds') || isFinanceError(error, 'over_credit_limit')) {
        if (!(await confirmWarning(error))) return null;
        options.allowNegative = true;
        continue;
      }
      if (isFinanceError(error, 'duplicate_transfer')) {
        if (!(await confirmWarning(error))) return null;
        options.allowDuplicate = true;
        continue;
      }
      throw error;
    }
  }
  return null;
}
