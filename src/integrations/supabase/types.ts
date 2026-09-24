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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          balance: number
          created_at: string
          email: string | null
          fraud_score: number
          id: string
          last_login: string | null
          last_task: string | null
          name: string
          phone: string
          referral_code: string
          referred_by: string | null
          sms_opt_out: boolean
          status: Database["public"]["Enums"]["account_status"]
          streak: number
          tier: Database["public"]["Enums"]["account_tier"]
        }
        Insert: {
          activated_at?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          fraud_score?: number
          id: string
          last_login?: string | null
          last_task?: string | null
          name: string
          phone: string
          referral_code: string
          referred_by?: string | null
          sms_opt_out?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          streak?: number
          tier?: Database["public"]["Enums"]["account_tier"]
        }
        Update: {
          activated_at?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          fraud_score?: number
          id?: string
          last_login?: string | null
          last_task?: string | null
          name?: string
          phone?: string
          referral_code?: string
          referred_by?: string | null
          sms_opt_out?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          streak?: number
          tier?: Database["public"]["Enums"]["account_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          attempts: number
          dedupe_key: string | null
          http_code: number | null
          id: string
          message: string
          phone: string
          response: string | null
          sent_at: string
          status: string
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          dedupe_key?: string | null
          http_code?: number | null
          id?: string
          message: string
          phone: string
          response?: string | null
          sent_at?: string
          status?: string
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          dedupe_key?: string | null
          http_code?: number | null
          id?: string
          message?: string
          phone?: string
          response?: string | null
          sent_at?: string
          status?: string
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stk_transactions: {
        Row: {
          amount: number
          callback_payload: Json | null
          checkout_request_id: string | null
          created_at: string
          failure_reason: string | null
          id: string
          merchant_request_id: string | null
          phone: string
          ref: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          tier: Database["public"]["Enums"]["account_tier"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          callback_payload?: Json | null
          checkout_request_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          merchant_request_id?: string | null
          phone: string
          ref: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          tier: Database["public"]["Enums"]["account_tier"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          callback_payload?: Json | null
          checkout_request_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          merchant_request_id?: string | null
          phone?: string
          ref?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          tier?: Database["public"]["Enums"]["account_tier"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stk_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          created_at: string
          id: string
          proof: string | null
          reward: number
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proof?: string | null
          reward: number
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proof?: string | null
          reward?: number
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          action_url: string | null
          category: string
          created_at: string
          description: string | null
          est_minutes: number
          id: string
          instructions: string | null
          is_active: boolean
          requires_proof: boolean
          reward_pro: number
          reward_standard: number
          reward_starter: number
          slots_total: number | null
          slots_used: number
          sponsor_name: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          category: string
          created_at?: string
          description?: string | null
          est_minutes?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          requires_proof?: boolean
          reward_pro: number
          reward_standard: number
          reward_starter: number
          slots_total?: number | null
          slots_used?: number
          sponsor_name?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          est_minutes?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          requires_proof?: boolean
          reward_pro?: number
          reward_standard?: number
          reward_starter?: number
          slots_total?: number | null
          slots_used?: number
          sponsor_name?: string | null
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_stk: {
        Args: {
          _actor?: string
          _amount: number
          _payload: Json
          _ref: string
          _txid: string
        }
        Returns: Json
      }
      complete_task: { Args: { _task_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recent_activity: {
        Args: never
        Returns: {
          amount: number
          at: string
          kind: string
          who: string
        }[]
      }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended"
      account_tier: "starter" | "standard" | "pro"
      app_role: "admin" | "customer"
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
      account_status: ["pending", "active", "suspended"],
      account_tier: ["starter", "standard", "pro"],
      app_role: ["admin", "customer"],
    },
  },
} as const
