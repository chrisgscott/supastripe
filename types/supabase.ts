export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          plan_creation_status: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          plan_creation_status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          plan_creation_status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          email_type: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          recipient_email: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          email_type: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          email_type?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          subject: string
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          subject: string
          template_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          created_at: string | null
          customer_id: string
          downpayment_amount: number
          id: string
          idempotency_key: string | null
          number_of_payments: number
          payment_interval: string
          plan_creation_status: string | null
          status: string
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          downpayment_amount: number
          id?: string
          idempotency_key?: string | null
          number_of_payments: number
          payment_interval: string
          plan_creation_status?: string | null
          status?: string
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          downpayment_amount?: number
          id?: string
          idempotency_key?: string | null
          number_of_payments?: number
          payment_interval?: string
          plan_creation_status?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_plans_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_processing_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          status: string
          stripe_payment_intent_id: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          status: string
          stripe_payment_intent_id?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          status?: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_processing_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_details"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "payment_processing_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "detailed_transactions"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "payment_processing_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          arrival_date: string
          created_at: string | null
          currency: string
          id: number
          status: string
          stripe_account_id: string
          stripe_payout_id: string
        }
        Insert: {
          amount: number
          arrival_date: string
          created_at?: string | null
          currency: string
          id?: number
          status: string
          stripe_account_id: string
          stripe_payout_id: string
        }
        Update: {
          amount?: number
          arrival_date?: string
          created_at?: string | null
          currency?: string
          id?: number
          status?: string
          stripe_account_id?: string
          stripe_payout_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postal_code: string | null
          address_state: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          business_url: string | null
          created_at: string | null
          first_name: string | null
          id: string
          is_onboarded: boolean | null
          last_name: string | null
          logo_url: string | null
          stripe_account_id: string | null
          support_email: string | null
          support_phone: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          business_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          is_onboarded?: boolean | null
          last_name?: string | null
          logo_url?: string | null
          stripe_account_id?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          business_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_onboarded?: boolean | null
          last_name?: string | null
          logo_url?: string | null
          stripe_account_id?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          created_at: string | null
          id: string
          stripe_account_created_at: string | null
          stripe_account_details_url: string | null
          stripe_account_id: string | null
          stripe_onboarding_completed: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_reviews: {
        Row: {
          closed_at: string | null
          created_at: string | null
          id: number
          opened_at: string
          reason: string
          status: string
          stripe_account_id: string
          stripe_review_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          id?: number
          opened_at: string
          reason: string
          status: string
          stripe_account_id: string
          stripe_review_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          id?: number
          opened_at?: string
          reason?: string
          status?: string
          stripe_account_id?: string
          stripe_review_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          is_downpayment: boolean | null
          last_reminder_email_log_id: string | null
          next_attempt_date: string | null
          paid_at: string | null
          payment_plan_id: string
          plan_creation_status: string | null
          reminder_email_date: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          is_downpayment?: boolean | null
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id: string
          plan_creation_status?: string | null
          reminder_email_date?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          is_downpayment?: boolean | null
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id?: string
          plan_creation_status?: string | null
          reminder_email_date?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_last_reminder_email_log_id_fkey"
            columns: ["last_reminder_email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_details"
            referencedColumns: ["payment_plan_id"]
          },
          {
            foreignKeyName: "transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_states: {
        Row: {
          id: string
          payment_plan_id: string
          status: 'draft' | 'pending_customer_approval' | 'changes_requested' | 'pending_payment' | 'completed' | 'cancelled' | 'paused'
          payment_link_token: string | null
          payment_link_expires_at: string | null
          change_request_notes: string | null
          reminder_count: number
          last_reminder_sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payment_plan_id: string
          status: 'draft' | 'pending_customer_approval' | 'changes_requested' | 'pending_payment' | 'completed' | 'cancelled' | 'paused'
          payment_link_token?: string | null
          payment_link_expires_at?: string | null
          change_request_notes?: string | null
          reminder_count?: number
          last_reminder_sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          payment_plan_id?: string
          status?: 'draft' | 'pending_customer_approval' | 'changes_requested' | 'pending_payment' | 'completed' | 'cancelled' | 'paused'
          payment_link_token?: string | null
          payment_link_expires_at?: string | null
          change_request_notes?: string | null
          reminder_count?: number
          last_reminder_sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_states_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: true
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      customer_payment_details: {
        Row: {
          customer_name: string | null
          date_created: string | null
          payment_plan_id: string | null
          payment_plan_status: string | null
          transaction_amount: number | null
          transaction_due_date: string | null
          transaction_id: string | null
          transaction_status: string | null
        }
        Relationships: []
      }
      detailed_transactions: {
        Row: {
          amount: number | null
          customer_email: string | null
          due_date: string | null
          is_downpayment: boolean | null
          payment_plan_id: string | null
          payment_plan_status: string | null
          seller_business_name: string | null
          seller_email: string | null
          seller_user_id: string | null
          stripe_payment_intent_id: string | null
          transaction_id: string | null
          transaction_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_plans_user"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_details"
            referencedColumns: ["payment_plan_id"]
          },
          {
            foreignKeyName: "transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      begin_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_pending_plans: {
        Args: {
          older_than: string
        }
        Returns: undefined
      }
      commit_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      complete_payment_plan_creation: {
        Args: {
          p_payment_plan_id: string
          p_stripe_payment_intent_id: string
        }
        Returns: undefined
      }
      create_payment_plan: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_total_amount: number
          p_number_of_payments: number
          p_payment_interval: string
          p_downpayment_amount: number
          p_payment_schedule: Json
        }
        Returns: string
      }
      create_payment_plan_step1: {
        Args: {
          p_customer_name: string
          p_customer_email: string
          p_user_id: string
          p_total_amount: number
          p_number_of_payments: number
          p_payment_interval: string
          p_downpayment_amount: number
          p_payment_schedule: Json
          p_stripe_customer_id: string
        }
        Returns: Json
      }
      handle_successful_payment: {
        Args: {
          p_transaction_id: string
          p_paid_at: string
        }
        Returns: Json
      }
      rollback_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
