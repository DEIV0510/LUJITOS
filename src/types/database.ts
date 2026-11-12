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
  | 'cdt'
  | 'investment_fund'
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
  /** Nombre de la entidad cuando no está en la lista (institution = custom). */
  institution_name: string | null;
  description: string | null;
  /** Solo tarjetas: día de corte y día límite de pago (1–31). */
  statement_day: number | null;
  payment_due_day: number | null;
  client_request_id: string | null;
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
  archived_at: string | null;
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
  /** Anulación: deja de contar en los saldos, pero se conserva. */
  deleted_at: string | null;
  void_reason: string | null;
  client_request_id: string | null;
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
  total_income: number;
  total_expense: number;
  transfers_in: number;
  transfers_out: number;
  adjustments_net: number;
  last_activity_at: string | null;
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
      // Escrituras solo por RPC (create_account, update_account, archive_account…).
      accounts: {
        Row: AccountRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Optional<CategoryRow, 'id' | 'user_id' | 'icon' | 'color' | 'is_default' | 'slug' | 'created_at' | 'archived_at'>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      // Escrituras solo por RPC (create_transaction, update_transaction, void_transaction…).
      transactions: {
        Row: TransactionRow;
        Insert: never;
        Update: never;
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
    // Funciones RPC del motor financiero (supabase/migrations/20261112090100_finance_engine.sql).
    Functions: {
      create_account: {
        Args: {
          p_name: string;
          p_account_type: AccountTypeDb;
          p_institution?: string;
          p_institution_name?: string | null;
          p_initial_balance?: number;
          p_credit_limit?: number | null;
          p_last_four_digits?: string | null;
          p_color?: string | null;
          p_icon?: string | null;
          p_description?: string | null;
          p_statement_day?: number | null;
          p_payment_due_day?: number | null;
          p_request_id?: string | null;
        };
        Returns: string;
      };
      update_account: {
        Args: {
          p_account_id: string;
          p_name: string;
          p_account_type: AccountTypeDb;
          p_institution: string;
          p_institution_name: string | null;
          p_initial_balance: number;
          p_credit_limit: number | null;
          p_last_four_digits: string | null;
          p_color: string | null;
          p_icon: string | null;
          p_description: string | null;
          p_statement_day: number | null;
          p_payment_due_day: number | null;
        };
        Returns: string;
      };
      archive_account: { Args: { p_account_id: string; p_force?: boolean }; Returns: undefined };
      restore_account: { Args: { p_account_id: string }; Returns: undefined };
      create_transaction: {
        Args: {
          p_type: TransactionTypeDb;
          p_amount: number;
          p_account_id: string;
          p_destination_account_id?: string | null;
          p_category_id?: string | null;
          p_transaction_date?: string | null;
          p_description?: string;
          p_merchant?: string | null;
          p_notes?: string | null;
          p_request_id?: string | null;
          p_allow_negative?: boolean;
          p_allow_duplicate?: boolean;
        };
        Returns: string;
      };
      update_transaction: {
        Args: {
          p_transaction_id: string;
          p_amount: number;
          p_account_id: string;
          p_destination_account_id?: string | null;
          p_category_id?: string | null;
          p_transaction_date?: string | null;
          p_description?: string;
          p_merchant?: string | null;
          p_notes?: string | null;
          p_allow_negative?: boolean;
          p_allow_duplicate?: boolean;
        };
        Returns: string;
      };
      void_transaction: { Args: { p_transaction_id: string; p_reason?: string | null }; Returns: undefined };
      reconcile_account: {
        Args: {
          p_account_id: string;
          p_observed_balance: number;
          p_reason: string;
          p_expected_balance?: number | null;
          p_request_id?: string | null;
        };
        Returns: Json;
      };
      delete_category: { Args: { p_category_id: string; p_reassign_to?: string | null }; Returns: undefined };
      financial_summary: { Args: { p_month?: string | null }; Returns: Json };
      account_balance_history: {
        Args: { p_account_id: string; p_from: string; p_to: string };
        Returns: { day: string; balance: number }[];
      };
      transaction_effect: {
        Args: {
          p_type: TransactionTypeDb;
          p_amount: number;
          p_adjustment_sign: number | null;
          p_account_id: string | null;
          p_destination_account_id: string | null;
          p_target: string;
        };
        Returns: number;
      };
    };
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
