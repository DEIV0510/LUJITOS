export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_snapshots: {
        Row: {
          account_id: string
          balance: number
          created_at: string
          id: string
          snapshot_date: string
          user_id: string
        }
        Insert: {
          account_id: string
          balance: number
          created_at?: string
          id?: string
          snapshot_date: string
          user_id?: string
        }
        Update: {
          account_id?: string
          balance?: number
          created_at?: string
          id?: string
          snapshot_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "account_snapshots_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          archived_at: string | null
          client_request_id: string | null
          color: string | null
          connection_type: Database["public"]["Enums"]["connection_type"]
          created_at: string
          credit_limit: number | null
          currency: string
          description: string | null
          icon: string | null
          id: string
          initial_balance: number
          institution: string
          institution_name: string | null
          is_active: boolean
          last_four_digits: string | null
          name: string
          payment_due_day: number | null
          statement_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          archived_at?: string | null
          client_request_id?: string | null
          color?: string | null
          connection_type?: Database["public"]["Enums"]["connection_type"]
          created_at?: string
          credit_limit?: number | null
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string
          institution_name?: string | null
          is_active?: boolean
          last_four_digits?: string | null
          name: string
          payment_due_day?: number | null
          statement_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          archived_at?: string | null
          client_request_id?: string | null
          color?: string | null
          connection_type?: Database["public"]["Enums"]["connection_type"]
          created_at?: string
          credit_limit?: number | null
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string
          institution_name?: string | null
          is_active?: boolean
          last_four_digits?: string | null
          name?: string
          payment_due_day?: number | null
          statement_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[]
          created_at: string
          entity_id: string | null
          id: number
          user_id: string
        }
        Insert: {
          action: string
          changed_fields?: string[]
          created_at?: string
          entity_id?: string | null
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          changed_fields?: string[]
          created_at?: string
          entity_id?: string | null
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      budget_alerts: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          kind: string
          limit_amount: number
          period_start: string
          seen_at: string | null
          spent: number
          threshold: number
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          kind: string
          limit_amount: number
          period_start: string
          seen_at?: string | null
          spent: number
          threshold: number
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          kind?: string
          limit_amount?: number
          period_start?: string
          seen_at?: string | null
          spent?: number
          threshold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_status"
            referencedColumns: ["budget_id"]
          },
          {
            foreignKeyName: "budget_alerts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          alert_thresholds: number[]
          archived_at: string | null
          category_id: string | null
          client_request_id: string | null
          created_at: string
          end_date: string | null
          id: string
          limit_amount: number
          name: string | null
          period: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_thresholds?: number[]
          archived_at?: string | null
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          limit_amount: number
          name?: string | null
          period: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          alert_thresholds?: number[]
          archived_at?: string | null
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          limit_amount?: number
          name?: string | null
          period?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          is_essential: boolean
          is_fixed: boolean
          name: string
          slug: string | null
          type: Database["public"]["Enums"]["category_type"]
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          is_essential?: boolean
          is_fixed?: boolean
          name: string
          slug?: string | null
          type: Database["public"]["Enums"]["category_type"]
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          is_essential?: boolean
          is_fixed?: boolean
          name?: string
          slug?: string | null
          type?: Database["public"]["Enums"]["category_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      debts: {
        Row: {
          account_id: string
          client_request_id: string | null
          created_at: string
          creditor: string | null
          description: string | null
          due_date: string | null
          first_payment_date: string | null
          frequency: string
          id: string
          installment_amount: number | null
          interest_period: string | null
          interest_rate: number | null
          kind: string
          original_amount: number
          payment_account_id: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          client_request_id?: string | null
          created_at?: string
          creditor?: string | null
          description?: string | null
          due_date?: string | null
          first_payment_date?: string | null
          frequency?: string
          id?: string
          installment_amount?: number | null
          interest_period?: string | null
          interest_rate?: number | null
          kind?: string
          original_amount: number
          payment_account_id?: string | null
          start_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          client_request_id?: string | null
          created_at?: string
          creditor?: string | null
          description?: string | null
          due_date?: string | null
          first_payment_date?: string | null
          frequency?: string
          id?: string
          installment_amount?: number | null
          interest_period?: string | null
          interest_rate?: number | null
          kind?: string
          original_amount?: number
          payment_account_id?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "debts_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "debts_payment_account_fk"
            columns: ["payment_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "debts_payment_account_fk"
            columns: ["payment_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string
          created_at: string
          currency: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          onboarding_completed_at: string | null
          terms_accepted_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string | null
          first_name?: string
          id: string
          last_name?: string
          onboarding_completed_at?: string | null
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          onboarding_completed_at?: string | null
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      savings_goal_movements: {
        Row: {
          amount: number
          client_request_id: string | null
          created_at: string
          goal_id: string
          id: string
          kind: string
          movement_date: string
          note: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          client_request_id?: string | null
          created_at?: string
          goal_id: string
          id?: string
          kind: string
          movement_date?: string
          note?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          client_request_id?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          kind?: string
          movement_date?: string
          note?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goal_movements_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "savings_goal_progress"
            referencedColumns: ["goal_id", "user_id"]
          },
          {
            foreignKeyName: "savings_goal_movements_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "savings_goal_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          account_id: string | null
          archived_at: string | null
          client_request_id: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          initial_saved: number
          kind: string
          name: string
          start_date: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          client_request_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_saved?: number
          kind?: string
          name: string
          start_date?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          client_request_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_saved?: number
          kind?: string
          name?: string
          start_date?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "savings_goals_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          adjustment_sign: number | null
          amount: number
          category_id: string | null
          client_request_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          destination_account_id: string | null
          id: string
          merchant: string | null
          notes: string | null
          purpose: string | null
          source: Database["public"]["Enums"]["transaction_source"]
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          void_reason: string | null
        }
        Insert: {
          account_id?: string | null
          adjustment_sign?: number | null
          amount: number
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          destination_account_id?: string | null
          id?: string
          merchant?: string | null
          notes?: string | null
          purpose?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          void_reason?: string | null
        }
        Update: {
          account_id?: string | null
          adjustment_sign?: number | null
          amount?: number
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          destination_account_id?: string | null
          id?: string
          merchant?: string | null
          notes?: string | null
          purpose?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transactions_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transactions_destination_fk"
            columns: ["destination_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          biometric_enabled: boolean
          created_at: string
          currency: string
          hide_amounts: boolean
          id: string
          notifications_enabled: boolean
          theme: Database["public"]["Enums"]["theme_preference"]
          updated_at: string
          user_id: string
        }
        Insert: {
          biometric_enabled?: boolean
          created_at?: string
          currency?: string
          hide_amounts?: boolean
          id?: string
          notifications_enabled?: boolean
          theme?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
          user_id: string
        }
        Update: {
          biometric_enabled?: boolean
          created_at?: string
          currency?: string
          hide_amounts?: boolean
          id?: string
          notifications_enabled?: boolean
          theme?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          adjustments_net: number | null
          balance: number | null
          last_activity_at: string | null
          last_transaction_date: string | null
          total_expense: number | null
          total_income: number | null
          transaction_count: number | null
          transfers_in: number | null
          transfers_out: number | null
          user_id: string | null
        }
        Relationships: []
      }
      budget_status: {
        Row: {
          available: number | null
          budget_id: string | null
          days_left: number | null
          limit_amount: number | null
          percent_used: number | null
          period_end: string | null
          period_start: string | null
          previous_period_start: string | null
          previous_spent: number | null
          spent: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      debt_overview: {
        Row: {
          account_id: string | null
          credit_balance: number | null
          days_to_due: number | null
          days_to_next_payment: number | null
          debt_id: string | null
          disbursed: number | null
          initial_outstanding: number | null
          installments_paid: number | null
          interest_registered: number | null
          last_payment_date: string | null
          next_payment_date: string | null
          outstanding: number | null
          paid_before: number | null
          percent_paid: number | null
          status: string | null
          total_paid: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "debts_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      savings_goal_progress: {
        Row: {
          account_allocated: number | null
          account_balance: number | null
          contributed: number | null
          daily_needed: number | null
          days_left: number | null
          exceeded_by: number | null
          goal_id: string | null
          last_movement_date: string | null
          monthly_needed: number | null
          movement_count: number | null
          percent: number | null
          remaining: number | null
          saved: number | null
          status: string | null
          unassigned: boolean | null
          user_id: string | null
          weekly_needed: number | null
          withdrawn: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_balance_history: {
        Args: { p_account_id: string; p_from: string; p_to: string }
        Returns: {
          balance: number
          day: string
        }[]
      }
      add_goal_movement: {
        Args: {
          p_account_id?: string
          p_allow_negative?: boolean
          p_amount: number
          p_goal_id: string
          p_kind: string
          p_movement_date?: string
          p_note?: string
          p_request_id?: string
        }
        Returns: string
      }
      archive_account: {
        Args: { p_account_id: string; p_force?: boolean }
        Returns: undefined
      }
      archive_budget: {
        Args: { p_archived?: boolean; p_budget_id: string }
        Returns: undefined
      }
      archive_debt: {
        Args: { p_archived?: boolean; p_debt_id: string; p_force?: boolean }
        Returns: undefined
      }
      archive_savings_goal: {
        Args: { p_archived?: boolean; p_goal_id: string }
        Returns: undefined
      }
      budget_history: {
        Args: { p_budget_id: string; p_periods?: number }
        Returns: {
          limit_amount: number
          percent_used: number
          period_end: string
          period_start: string
          spent: number
        }[]
      }
      budget_period_bounds: {
        Args: {
          p_end: string
          p_period: string
          p_ref: string
          p_start: string
        }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      create_account: {
        Args: {
          p_account_type: Database["public"]["Enums"]["account_type"]
          p_color?: string
          p_credit_limit?: number
          p_description?: string
          p_icon?: string
          p_initial_balance?: number
          p_institution?: string
          p_institution_name?: string
          p_last_four_digits?: string
          p_name: string
          p_payment_due_day?: number
          p_request_id?: string
          p_statement_day?: number
        }
        Returns: string
      }
      create_budget: {
        Args: {
          p_alert_thresholds?: number[]
          p_category_id: string
          p_end_date?: string
          p_limit_amount: number
          p_name?: string
          p_period: string
          p_request_id?: string
          p_start_date?: string
        }
        Returns: string
      }
      create_debt: {
        Args: {
          p_color?: string
          p_creditor?: string
          p_description?: string
          p_due_date?: string
          p_first_payment_date?: string
          p_frequency?: string
          p_installment_amount?: number
          p_interest_period?: string
          p_interest_rate?: number
          p_kind?: string
          p_name: string
          p_original_amount: number
          p_outstanding: number
          p_payment_account_id?: string
          p_request_id?: string
          p_start_date?: string
        }
        Returns: string
      }
      create_savings_goal: {
        Args: {
          p_account_id?: string
          p_color?: string
          p_description?: string
          p_icon?: string
          p_initial_saved?: number
          p_kind?: string
          p_name: string
          p_request_id?: string
          p_start_date?: string
          p_target_amount: number
          p_target_date?: string
        }
        Returns: string
      }
      create_transaction: {
        Args: {
          p_account_id: string
          p_allow_duplicate?: boolean
          p_allow_negative?: boolean
          p_amount: number
          p_category_id?: string
          p_description?: string
          p_destination_account_id?: string
          p_merchant?: string
          p_notes?: string
          p_request_id?: string
          p_transaction_date?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: string
      }
      delete_budget: { Args: { p_budget_id: string }; Returns: undefined }
      delete_category: {
        Args: { p_category_id: string; p_reassign_to?: string }
        Returns: undefined
      }
      delete_debt: { Args: { p_debt_id: string }; Returns: undefined }
      delete_savings_goal: { Args: { p_goal_id: string }; Returns: undefined }
      financial_summary: { Args: { p_month?: string }; Returns: Json }
      monthly_flows: {
        Args: { p_months?: number }
        Returns: {
          essential_expense: number
          expense: number
          fixed_expense: number
          income: number
          month_start: string
          movements: number
        }[]
      }
      planning_snapshot: { Args: never; Returns: Json }
      reconcile_account: {
        Args: {
          p_account_id: string
          p_expected_balance?: number
          p_observed_balance: number
          p_reason: string
          p_request_id?: string
        }
        Returns: Json
      }
      register_debt_payment: {
        Args: {
          p_account_id?: string
          p_allow_negative?: boolean
          p_allow_overpay?: boolean
          p_amount: number
          p_debt_id: string
          p_interest_portion?: number
          p_kind: string
          p_notes?: string
          p_payment_date?: string
          p_request_id?: string
        }
        Returns: Json
      }
      restore_account: { Args: { p_account_id: string }; Returns: undefined }
      spending_by_category: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_id: string
          movements: number
          total: number
        }[]
      }
      transaction_effect: {
        Args: {
          p_account_id: string
          p_adjustment_sign: number
          p_amount: number
          p_destination_account_id: string
          p_target: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: number
      }
      update_account: {
        Args: {
          p_account_id: string
          p_account_type: Database["public"]["Enums"]["account_type"]
          p_color: string
          p_credit_limit: number
          p_description: string
          p_icon: string
          p_initial_balance: number
          p_institution: string
          p_institution_name: string
          p_last_four_digits: string
          p_name: string
          p_payment_due_day: number
          p_statement_day: number
        }
        Returns: string
      }
      update_budget: {
        Args: {
          p_alert_thresholds: number[]
          p_budget_id: string
          p_category_id: string
          p_end_date: string
          p_limit_amount: number
          p_name: string
          p_period: string
          p_start_date: string
        }
        Returns: string
      }
      update_debt: {
        Args: {
          p_color: string
          p_creditor: string
          p_debt_id: string
          p_description: string
          p_due_date: string
          p_first_payment_date: string
          p_frequency: string
          p_initial_outstanding: number
          p_installment_amount: number
          p_interest_period: string
          p_interest_rate: number
          p_kind: string
          p_name: string
          p_original_amount: number
          p_payment_account_id: string
          p_start_date: string
        }
        Returns: string
      }
      update_goal_movement: {
        Args: {
          p_allow_negative?: boolean
          p_amount: number
          p_movement_date?: string
          p_movement_id: string
          p_note?: string
        }
        Returns: string
      }
      update_savings_goal: {
        Args: {
          p_account_id: string
          p_color: string
          p_description: string
          p_goal_id: string
          p_icon: string
          p_initial_saved: number
          p_kind: string
          p_name: string
          p_start_date: string
          p_target_amount: number
          p_target_date: string
        }
        Returns: string
      }
      update_transaction: {
        Args: {
          p_account_id: string
          p_allow_duplicate?: boolean
          p_allow_negative?: boolean
          p_amount: number
          p_category_id?: string
          p_description?: string
          p_destination_account_id?: string
          p_merchant?: string
          p_notes?: string
          p_transaction_date?: string
          p_transaction_id: string
        }
        Returns: string
      }
      void_goal_movement: {
        Args: { p_movement_id: string; p_reason?: string }
        Returns: undefined
      }
      void_transaction: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "bank"
        | "digital_wallet"
        | "cash"
        | "savings"
        | "checking"
        | "credit_card"
        | "loan"
        | "investment"
        | "cdt"
        | "investment_fund"
        | "other"
      category_type: "income" | "expense"
      connection_type: "manual" | "import" | "open_finance"
      theme_preference: "system" | "light" | "dark"
      transaction_source: "manual" | "import" | "open_finance" | "system"
      transaction_type: "income" | "expense" | "transfer" | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "bank",
        "digital_wallet",
        "cash",
        "savings",
        "checking",
        "credit_card",
        "loan",
        "investment",
        "cdt",
        "investment_fund",
        "other",
      ],
      category_type: ["income", "expense"],
      connection_type: ["manual", "import", "open_finance"],
      theme_preference: ["system", "light", "dark"],
      transaction_source: ["manual", "import", "open_finance", "system"],
      transaction_type: ["income", "expense", "transfer", "adjustment"],
    },
  },
} as const
