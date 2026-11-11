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
// solo last_transaction_date puede ser NULL (id es PK, user_id NOT NULL, saldo con coalesce).
type BalanceViewReal = Flat<
  { [K in Exclude<keyof BalanceView, 'last_transaction_date'>]: NonNullable<BalanceView[K]> } & {
    last_transaction_date: BalanceView['last_transaction_date'];
  }
>;

export type DatabaseTypesMatch = [
  Expect<Equal<Flat<Tables['profiles']['Row']>, Flat<Hand.ProfileRow>>>,
  Expect<Equal<Flat<Tables['accounts']['Row']>, Flat<Hand.AccountRow>>>,
  Expect<Equal<Flat<Tables['categories']['Row']>, Flat<Hand.CategoryRow>>>,
  Expect<Equal<Flat<Tables['transactions']['Row']>, Flat<Hand.TransactionRow>>>,
  Expect<Equal<Flat<Tables['account_snapshots']['Row']>, Flat<Hand.AccountSnapshotRow>>>,
  Expect<Equal<Flat<Tables['user_preferences']['Row']>, Flat<Hand.UserPreferencesRow>>>,
  Expect<Equal<BalanceViewReal, Flat<Hand.AccountBalanceRow>>>,
  Expect<Equal<Enums['account_type'], Hand.AccountTypeDb>>,
  Expect<Equal<Enums['connection_type'], Hand.ConnectionTypeDb>>,
  Expect<Equal<Enums['category_type'], Hand.CategoryTypeDb>>,
  Expect<Equal<Enums['transaction_type'], Hand.TransactionTypeDb>>,
  Expect<Equal<Enums['transaction_source'], Hand.TransactionSourceDb>>,
  Expect<Equal<Enums['theme_preference'], Hand.ThemePreferenceDb>>,
];
