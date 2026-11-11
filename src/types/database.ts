/**
 * Tipos de la base de datos de LUJITOS (esquema public).
 * Coinciden con supabase/migrations/. Tras una migración nueva:
 *   npm run db:types   (regenera database.generated.ts desde la base real)
 *   npm run typecheck  (database.check.ts falla si este archivo quedó desalineado)
 * Montos BIGINT = pesos colombianos enteros.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type AccountTypeDb =
  | 'bank'
  | 'digital_wallet'
  | 'cash'
  | 'savings'
  | 'checking'
  | 'credit_card'
  | 'investment'
  | 'other';
export type ConnectionTypeDb = 'manual' | 'import' | 'open_finance';
export type CategoryTypeDb = 'income' | 'expense';
export type TransactionTypeDb = 'income' | 'expense' | 'transfer' | 'adjustment';
export type TransactionSourceDb = 'manual' | 'import' | 'open_finance' | 'system';
export type ThemePreferenceDb = 'system' | 'light' | 'dark';

export type ProfileRow = Timestamps & {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  avatar_url: string | null;
  currency: string;
  country: string;
  timezone: string;
  terms_accepted_at: string | null;
  onboarding_completed_at: string | null;
};

export type AccountRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  institution: string;
  account_type: AccountTypeDb;
  initial_balance: number;
  currency: string;
  last_four_digits: string | null;
  color: string | null;
  icon: string | null;
  connection_type: ConnectionTypeDb;
  credit_limit: number | null;
  is_active: boolean;
  archived_at: string | null;
};

export type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryTypeDb;
  icon: string;
  color: string;
  is_default: boolean;
  slug: string | null;
  created_at: string;
};

export type TransactionRow = Timestamps & {
  id: string;
  user_id: string;
  account_id: string | null;
  destination_account_id: string | null;
  category_id: string | null;
  type: TransactionTypeDb;
  amount: number;
  adjustment_sign: number | null;
  description: string;
  merchant: string | null;
  notes: string | null;
  transaction_date: string;
  source: TransactionSourceDb;
  deleted_at: string | null;
};

export type AccountSnapshotRow = {
  id: string;
  user_id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  created_at: string;
};

export type UserPreferencesRow = Timestamps & {
  id: string;
  user_id: string;
  theme: ThemePreferenceDb;
  notifications_enabled: boolean;
  biometric_enabled: boolean;
  hide_amounts: boolean;
  currency: string;
};

export type AccountBalanceRow = {
  account_id: string;
  user_id: string;
  balance: number;
  transaction_count: number;
  last_transaction_date: string | null;
};

/** Auditoría: solo lectura desde la app. Sin montos, textos, contraseñas ni tokens. */
export type AuditLogRow = {
  id: number;
  user_id: string;
  /** p. ej. 'auth.signed_in', 'account.archived', 'transaction.deleted'. */
  action: string;
  entity_id: string | null;
  /** Nombres de los campos que cambiaron (nunca sus valores). */
  changed_fields: string[];
  created_at: string;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  __InternalSupabase: { PostgrestVersion: '13' };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Optional<ProfileRow, Exclude<keyof ProfileRow, 'id'>>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      accounts: {
        Row: AccountRow;
        Insert: Optional<
          AccountRow,
          | 'id'
          | 'user_id'
          | 'institution'
          | 'initial_balance'
          | 'currency'
          | 'last_four_digits'
          | 'color'
          | 'icon'
          | 'connection_type'
          | 'credit_limit'
          | 'is_active'
          | 'archived_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<AccountRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Optional<CategoryRow, 'id' | 'user_id' | 'icon' | 'color' | 'is_default' | 'slug' | 'created_at'>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Optional<
          TransactionRow,
          | 'id'
          | 'user_id'
          | 'account_id'
          | 'destination_account_id'
          | 'category_id'
          | 'adjustment_sign'
          | 'description'
          | 'merchant'
          | 'notes'
          | 'transaction_date'
          | 'source'
          | 'deleted_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<TransactionRow>;
        Relationships: [];
      };
      account_snapshots: {
        Row: AccountSnapshotRow;
        Insert: Optional<AccountSnapshotRow, 'id' | 'user_id' | 'created_at'>;
        Update: Partial<AccountSnapshotRow>;
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreferencesRow;
        Insert: Optional<UserPreferencesRow, Exclude<keyof UserPreferencesRow, 'user_id'>>;
        Update: Partial<UserPreferencesRow>;
        Relationships: [];
      };
      // La escriben triggers de la base; RLS y permisos impiden insertar desde la app.
      audit_logs: {
        Row: AuditLogRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      account_balances: { Row: AccountBalanceRow; Relationships: [] };
    };
    Functions: { [_ in never]: never };
    Enums: {
      account_type: AccountTypeDb;
      connection_type: ConnectionTypeDb;
      category_type: CategoryTypeDb;
      transaction_type: TransactionTypeDb;
      transaction_source: TransactionSourceDb;
      theme_preference: ThemePreferenceDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
