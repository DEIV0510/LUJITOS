/**
 * Comprobación en tiempo de compilación: los tipos escritos a mano
 * (database.ts) deben coincidir con los generados desde la base real
 * (database.generated.ts, `npm run db:types`). Si una migración cambia una
 * columna y no se actualiza database.ts, `npm run typecheck` falla aquí.
 * No genera código: solo tipos.
 */
import type { Database as Generated } from './database.generated';
import type * as Hand from './database';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Flat<T> = { [K in keyof T]: T[K] };
type Expect<T extends true> = T;

type Tables = Generated['public']['Tables'];
type Enums = Generated['public']['Enums'];
type BalanceView = Generated['public']['Views']['account_balances']['Row'];

// Postgres declara anulables todas las columnas de una vista. En account_balances
// solo las fechas del último movimiento pueden ser NULL (cuenta sin movimientos);
// id es PK, user_id NOT NULL y los montos usan coalesce.
type NullableBalanceColumns = 'last_transaction_date' | 'last_activity_at';
type BalanceViewReal = Flat<
  { [K in Exclude<keyof BalanceView, NullableBalanceColumns>]: NonNullable<BalanceView[K]> } & {
    [K in NullableBalanceColumns]: BalanceView[K];
  }
>;

// Vistas de la Fase 5: mismas reglas (solo estas columnas pueden ser NULL).
type Views = Generated['public']['Views'];
type ViewReal<V, Nullable extends keyof V> = Flat<
  { [K in Exclude<keyof V, Nullable>]: NonNullable<V[K]> } & { [K in Nullable]: V[K] }
>;
type BudgetStatusReal = ViewReal<Views['budget_status']['Row'], 'previous_period_start' | 'previous_spent'>;
type GoalProgressReal = ViewReal<
  Views['savings_goal_progress']['Row'],
  'days_left' | 'monthly_needed' | 'weekly_needed' | 'daily_needed' | 'account_balance' | 'account_allocated' | 'last_movement_date'
>;
type DebtOverviewReal = ViewReal<
  Views['debt_overview']['Row'],
  'last_payment_date' | 'next_payment_date' | 'days_to_next_payment' | 'days_to_due'
>;

export type DatabaseTypesMatch = [
  Expect<Equal<Flat<Tables['profiles']['Row']>, Flat<Hand.ProfileRow>>>,
  Expect<Equal<Flat<Tables['accounts']['Row']>, Flat<Hand.AccountRow>>>,
  Expect<Equal<Flat<Tables['categories']['Row']>, Flat<Hand.CategoryRow>>>,
  Expect<Equal<Flat<Tables['transactions']['Row']>, Flat<Hand.TransactionRow>>>,
  Expect<Equal<Flat<Tables['account_snapshots']['Row']>, Flat<Hand.AccountSnapshotRow>>>,
  Expect<Equal<Flat<Tables['user_preferences']['Row']>, Flat<Hand.UserPreferencesRow>>>,
  Expect<Equal<Flat<Tables['audit_logs']['Row']>, Flat<Hand.AuditLogRow>>>,
  Expect<Equal<BalanceViewReal, Flat<Hand.AccountBalanceRow>>>,
  Expect<Equal<Flat<Tables['budgets']['Row']>, Flat<Hand.BudgetRow>>>,
  Expect<Equal<Flat<Tables['budget_alerts']['Row']>, Flat<Hand.BudgetAlertRow>>>,
  Expect<Equal<Flat<Tables['savings_goals']['Row']>, Flat<Hand.SavingsGoalRow>>>,
  Expect<Equal<Flat<Tables['savings_goal_movements']['Row']>, Flat<Hand.SavingsGoalMovementRow>>>,
  Expect<Equal<Flat<Tables['debts']['Row']>, Flat<Hand.DebtRow>>>,
  Expect<Equal<BudgetStatusReal, Flat<Hand.BudgetStatusRow>>>,
  Expect<Equal<GoalProgressReal, Flat<Hand.SavingsGoalProgressRow>>>,
  Expect<Equal<DebtOverviewReal, Flat<Hand.DebtOverviewRow>>>,
  Expect<Equal<Enums['account_type'], Hand.AccountTypeDb>>,
  Expect<Equal<Enums['connection_type'], Hand.ConnectionTypeDb>>,
  Expect<Equal<Enums['category_type'], Hand.CategoryTypeDb>>,
  Expect<Equal<Enums['transaction_type'], Hand.TransactionTypeDb>>,
  Expect<Equal<Enums['transaction_source'], Hand.TransactionSourceDb>>,
  Expect<Equal<Enums['theme_preference'], Hand.ThemePreferenceDb>>,
];
