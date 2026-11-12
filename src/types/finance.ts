import type { SFSymbol } from 'expo-symbols';

import type { ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import type { Tone } from '@/theme';

export type IconName = SFSymbol;

export type InstitutionId =
  | 'bancolombia'
  | 'nequi'
  | 'davivienda'
  | 'daviplata'
  | 'bbva'
  | 'bogota'
  | 'cajasocial'
  | 'nu'
  | 'cash'
  | 'custom';

export type Institution = {
  id: InstitutionId;
  name: string;
  /** Iniciales del identificador visual (no se usan logotipos oficiales). */
  initials: string;
  tone: Tone;
  icon?: IconName;
};

/** Igual al enum public.account_type de la base de datos. */
export type AccountKind =
  | 'bank'
  | 'savings'
  | 'checking'
  | 'digital_wallet'
  | 'cash'
  | 'investment'
  | 'cdt'
  | 'investment_fund'
  | 'credit_card'
  | 'other';

export type AccountGroup = 'banks' | 'wallets' | 'cash' | 'other' | 'investments' | 'credit';

export type RegistrationMethod = 'manual' | 'imported' | 'connected';

/** Resumen de una cuenta calculado en PostgreSQL (vista account_balances). */
export type AccountStats = {
  totalIncome: Money;
  totalExpense: Money;
  transfersIn: Money;
  transfersOut: Money;
  adjustmentsNet: Money;
  transactionCount: number;
  lastTransactionDate: ISODate | null;
  /** Último movimiento registrado o editado (fecha y hora). */
  lastActivityAt: string | null;
};

export type Account = {
  id: string;
  name: string;
  institutionId: InstitutionId;
  /** Nombre de la entidad cuando no está en la lista. */
  institutionName?: string | null;
  kind: AccountKind;
  /**
   * Saldo actual calculado en el servidor: inicial + movimientos no anulados.
   * En tarjetas es negativo cuando hay deuda (deuda = −saldo).
   */
  balance: Money;
  /** Dinero o deuda (negativo) con el que empezó en LUJITOS. */
  initialBalance: Money;
  currency: 'COP';
  createdAt: ISODate;
  updatedAt?: string;
  lastFour?: string;
  method: RegistrationMethod;
  creditLimit?: Money;
  isActive?: boolean;
  /** Tono de la paleta elegido por el usuario. */
  color?: string | null;
  /** SF Symbol elegido por el usuario. */
  icon?: string | null;
  description?: string | null;
  /** Solo tarjetas: día de corte y día límite de pago. */
  statementDay?: number | null;
  paymentDueDay?: number | null;
  stats?: AccountStats;
};

/** Tipos que se registran desde el formulario. */
export type TransactionType = 'income' | 'expense' | 'transfer';
/** Tipos que pueden existir en la base (incluye ajustes de saldo). */
export type StoredTransactionType = TransactionType | 'adjustment';

export type Transaction = {
  id: string;
  type: StoredTransactionType;
  /** Solo ajustes: +1 suma, −1 resta. */
  adjustmentSign?: 1 | -1;
  /** Siempre positivo; el tipo define si suma o resta. */
  amount: Money;
  accountId: string;
  /** Solo transferencias. */
  toAccountId?: string;
  categoryId?: string;
  description: string;
  counterparty?: string;
  date: ISODate;
  notes?: string;
  tags?: string[];
  /** Fecha y hora de anulación (los anulados se conservan). */
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt?: string;
};

export type CategoryKind = 'income' | 'expense';

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: IconName;
  tone: Tone;
  /** Clave estable de las categorías del sistema (salary, food…). */
  slug?: string | null;
  isDefault?: boolean;
  /** Archivada: no se ofrece para movimientos nuevos, pero conserva su historial. */
  archivedAt?: string | null;
};

export type BudgetLine = {
  categoryId: string;
  limit: Money;
};

export type SavingsGoal = {
  id: string;
  name: string;
  description: string;
  target: Money;
  saved: Money;
  deadline: ISODate;
  priority: 'alta' | 'media' | 'baja';
  accountId?: string;
  icon: IconName;
  tone: Tone;
};

export type DebtKind = 'credit_card' | 'loan' | 'installments' | 'personal';

export type Debt = {
  id: string;
  name: string;
  kind: DebtKind;
  lender: string;
  balance: Money;
  original: Money;
  /** Tasa efectiva anual en porcentaje. */
  annualRate: number;
  monthlyPayment: Money;
  nextDue: ISODate;
  installmentsLeft?: number;
};

export type CreditCard = {
  id: string;
  accountId: string;
  name: string;
  network: 'Visa' | 'Mastercard';
  lastFour: string;
  limit: Money;
  used: Money;
  cutoffDay: number;
  dueDate: ISODate;
  minimumPayment: Money;
  installments: { description: string; current: number; total: number; amount: Money }[];
};

export type RecurringPayment = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: Money;
  categoryId: string;
  accountId: string;
  frequency: 'Mensual' | 'Quincenal' | 'Anual';
  dayOfMonth: number;
  nextDate: ISODate;
  variable?: boolean;
};

export type AppNotification = {
  id: string;
  kind: 'budget' | 'due' | 'goal' | 'info';
  title: string;
  body: string;
  date: ISODate;
  read: boolean;
  href?: string;
};
