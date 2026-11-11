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
          color: string | null
          connection_type: Database["public"]["Enums"]["connection_type"]
          created_at: string
          credit_limit: number | null
          currency: string
          icon: string | null
          id: string
          initial_balance: number
          institution: string
          is_active: boolean
          last_four_digits: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          archived_at?: string | null
          color?: string | null
          connection_type?: Database["public"]["Enums"]["connection_type"]
          created_at?: string
          credit_limit?: number | null
          currency?: string
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string
          is_active?: boolean
          last_four_digits?: string | null
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          archived_at?: string | null
          color?: string | null
          connection_type?: Database["public"]["Enums"]["connection_type"]
          created_at?: string
          credit_limit?: number | null
          currency?: string
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string
          is_active?: boolean
          last_four_digits?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
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
        }
        Insert: {
          account_id?: string | null
          adjustment_sign?: number | null
          amount: number
          category_id?: string | null
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
        }
        Update: {
          account_id?: string | null
          adjustment_sign?: number | null
          amount?: number
          category_id?: string | null
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
          balance: number | null
          last_transaction_date: string | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
