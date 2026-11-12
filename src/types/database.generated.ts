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
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
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
          name?: string
          slug?: string | null
          type?: Database["public"]["Enums"]["category_type"]
          user_id?: string | null
        }
        Relationships: []
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
    }
    Functions: {
      account_balance_history: {
        Args: { p_account_id: string; p_from: string; p_to: string }
        Returns: {
          balance: number
          day: string
        }[]
      }
      archive_account: {
        Args: { p_account_id: string; p_force?: boolean }
        Returns: undefined
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
      delete_category: {
        Args: { p_category_id: string; p_reassign_to?: string }
        Returns: undefined
      }
      financial_summary: { Args: { p_month?: string }; Returns: Json }
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
      restore_account: { Args: { p_account_id: string }; Returns: undefined }
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
