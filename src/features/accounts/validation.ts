/** Validación del formulario de cuenta (el servidor vuelve a validar todo). */
import type { Money } from '@/lib/money';
import type { AccountKind, InstitutionId } from '@/types/finance';

export type AccountDraft = {
  name: string;
  institution: InstitutionId | null;
  institutionName: string;
  kind: AccountKind | null;
  /** Saldo inicial (≥ 0) o, en tarjetas, deuda inicial (≥ 0). */
  initial: Money;
  creditLimit: Money;
  statementDay: number | null;
  paymentDueDay: number | null;
  lastFour: string;
  description: string;
};

export type AccountErrors = Partial<
  Record<'name' | 'institution' | 'institutionName' | 'kind' | 'initial' | 'creditLimit' | 'lastFour' | 'description', string>
>;

export function validateAccountDraft(draft: AccountDraft): AccountErrors {
  const errors: AccountErrors = {};
  const name = draft.name.trim();
  if (name.length < 2) errors.name = 'Escribe un nombre para la cuenta.';
  else if (name.length > 60) errors.name = 'Máximo 60 caracteres.';
  if (!draft.institution) errors.institution = 'Elige la entidad.';
  else if (draft.institution === 'custom' && draft.institutionName.trim().length === 0) {
    errors.institutionName = 'Escribe el nombre de la entidad.';
  }
  if (!draft.kind) errors.kind = 'Elige el tipo de cuenta.';
  if (draft.initial < 0) errors.initial = 'El saldo inicial debe ser cero o un valor positivo.';
  if (draft.kind === 'credit_card' && draft.creditLimit <= 0) errors.creditLimit = 'Escribe el cupo total de la tarjeta.';
  if (draft.lastFour && !/^\d{4}$/.test(draft.lastFour)) errors.lastFour = 'Deben ser exactamente 4 dígitos.';
  if (draft.description.trim().length > 140) errors.description = 'Máximo 140 caracteres.';
  return errors;
}
