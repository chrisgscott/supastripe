export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          updated_at: string | null
          user_id: string
          stripe_customer_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
          stripe_customer_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
          stripe_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string | null
          customer_id: string
          downpayment_amount: number
          id: string
          number_of_payments: number
          payment_interval: string
          status: 'created' | 'active' | 'completed' | 'cancelled' | 'failed'
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          downpayment_amount: number
          id?: string
          number_of_payments: number
          payment_interval: string
          status: 'created' | 'active' | 'completed' | 'cancelled' | 'failed'
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          downpayment_amount?: number
          id?: string
          number_of_payments?: number
          payment_interval?: string
          status?: 'created' | 'active' | 'completed' | 'cancelled' | 'failed'
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          created_at: string | null
          updated_at: string | null
          first_name: string | null
          last_name: string | null
          business_name: string | null
          business_type: string | null
          business_description: string | null
          business_url: string | null
          support_email: string | null
          support_phone: string | null
          address_line1: string | null
          address_line2: string | null
          address_city: string | null
          address_state: string | null
          address_postal_code: string | null
          address_country: string | null
          is_onboarded: boolean
          logo_url: string | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          first_name?: string | null
          last_name?: string | null
          business_name?: string | null
          business_type?: string | null
          business_description?: string | null
          business_url?: string | null
          support_email?: string | null
          support_phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_city?: string | null
          address_state?: string | null
          address_postal_code?: string | null
          address_country?: string | null
          is_onboarded?: boolean
          logo_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          first_name?: string | null
          last_name?: string | null
          business_name?: string | null
          business_type?: string | null
          business_description?: string | null
          business_url?: string | null
          support_email?: string | null
          support_phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_city?: string | null
          address_state?: string | null
          address_postal_code?: string | null
          address_country?: string | null
          is_onboarded?: boolean
          logo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          id: string
          user_id: string
          stripe_account_id: string
          stripe_onboarding_completed: boolean
          stripe_account_created_at: string | null
          stripe_account_details_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          stripe_account_id: string
          stripe_onboarding_completed?: boolean
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          stripe_account_id?: string
          stripe_onboarding_completed?: boolean
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          payment_plan_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
          is_downpayment: boolean
          last_reminder_email_log_id: string | null
          idempotency_key: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          payment_plan_id: string
          status: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
          is_downpayment?: boolean
          last_reminder_email_log_id?: string | null
          idempotency_key?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          payment_plan_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
          is_downpayment?: boolean
          last_reminder_email_log_id?: string | null
          idempotency_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_last_reminder_email_log_id_fkey"
            columns: ["last_reminder_email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          }
        ]
      }
      email_templates: {
        Row: {
          id: string
          user_id: string
          template_type: string
          subject: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_type: string
          subject: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_type?: string
          subject?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      email_logs: {
        Row: {
          id: string
          email_type: string
          recipient_email: string
          status: string
          sent_at: string
          error_message: string | null
          related_id: string | null
          related_type: string | null
          idempotency_key: string
        }
        Insert: {
          id?: string
          email_type: string
          recipient_email: string
          status: string
          sent_at?: string
          error_message?: string | null
          related_id?: string | null
          related_type?: string | null
          idempotency_key?: string
        }
        Update: {
          id?: string
          email_type?: string
          recipient_email?: string
          status?: string
          sent_at?: string
          error_message?: string | null
          related_id?: string | null
          related_type?: string | null
          idempotency_key?: string
        }
        Relationships: []
      }
      payment_processing_logs: {
        Row: {
          id: string
          transaction_id: string
          status: string
          stripe_payment_intent_id: string | null
          error_message: string | null
          idempotency_key: string
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          status: string
          stripe_payment_intent_id?: string | null
          error_message?: string | null
          idempotency_key: string
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          error_message?: string | null
          idempotency_key?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_processing_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

