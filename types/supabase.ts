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
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers_backup: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      migration_20240415000000_completed: {
        Row: {
          completed_at: string | null
        }
        Insert: {
          completed_at?: string | null
        }
        Update: {
          completed_at?: string | null
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          card_expiration_month: number | null
          card_expiration_year: number | null
          card_last_four: string | null
          change_request_notes: string | null
          created_at: string | null
          customer_id: string
          downpayment_amount: number
          id: string
          idempotency_key: string | null
          last_reminder_sent_at: string | null
          notes: Json | null
          number_of_payments: number
          payment_interval: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at: string | null
          payment_link_token: string | null
          reminder_count: number | null
          status: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_expiration_month?: number | null
          card_expiration_year?: number | null
          card_last_four?: string | null
          change_request_notes?: string | null
          created_at?: string | null
          customer_id: string
          downpayment_amount: number
          id?: string
          idempotency_key?: string | null
          last_reminder_sent_at?: string | null
          notes?: Json | null
          number_of_payments: number
          payment_interval: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at?: string | null
          payment_link_token?: string | null
          reminder_count?: number | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at?: string | null
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_expiration_month?: number | null
          card_expiration_year?: number | null
          card_last_four?: string | null
          change_request_notes?: string | null
          created_at?: string | null
          customer_id?: string
          downpayment_amount?: number
          id?: string
          idempotency_key?: string | null
          last_reminder_sent_at?: string | null
          notes?: Json | null
          number_of_payments?: number
          payment_interval?: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at?: string | null
          payment_link_token?: string | null
          reminder_count?: number | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at?: string | null
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
        ]
      }
      payment_plans_backup: {
        Row: {
          card_last_four: string | null
          created_at: string | null
          customer_id: string | null
          downpayment_amount: number | null
          id: string | null
          idempotency_key: string | null
          notes: Json | null
          number_of_payments: number | null
          payment_interval: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_last_four?: string | null
          created_at?: string | null
          customer_id?: string | null
          downpayment_amount?: number | null
          id?: string | null
          idempotency_key?: string | null
          notes?: Json | null
          number_of_payments?: number | null
          payment_interval?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_last_four?: string | null
          created_at?: string | null
          customer_id?: string | null
          downpayment_amount?: number | null
          id?: string | null
          idempotency_key?: string | null
          notes?: Json | null
          number_of_payments?: number | null
          payment_interval?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_processing_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          payment_plan_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          payment_plan_id?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          payment_plan_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: [
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      pending_customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          stripe_customer_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          stripe_customer_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          stripe_customer_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pending_payment_plans: {
        Row: {
          card_expiration_month: number | null
          card_expiration_year: number | null
          card_last_four: string | null
          change_request_notes: string | null
          created_at: string | null
          customer_id: string
          downpayment_amount: number
          id: string
          idempotency_key: string | null
          last_reminder_sent_at: string | null
          notes: Json | null
          number_of_payments: number
          payment_interval: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at: string | null
          payment_link_token: string | null
          reminder_count: number | null
          status: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_expiration_month?: number | null
          card_expiration_year?: number | null
          card_last_four?: string | null
          change_request_notes?: string | null
          created_at?: string | null
          customer_id: string
          downpayment_amount: number
          id?: string
          idempotency_key?: string | null
          last_reminder_sent_at?: string | null
          notes?: Json | null
          number_of_payments: number
          payment_interval: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at?: string | null
          payment_link_token?: string | null
          reminder_count?: number | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at?: string | null
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_expiration_month?: number | null
          card_expiration_year?: number | null
          card_last_four?: string | null
          change_request_notes?: string | null
          created_at?: string | null
          customer_id?: string
          downpayment_amount?: number
          id?: string
          idempotency_key?: string | null
          last_reminder_sent_at?: string | null
          notes?: Json | null
          number_of_payments?: number
          payment_interval?: Database["public"]["Enums"]["payment_interval_type"]
          payment_link_expires_at?: string | null
          payment_link_token?: string | null
          reminder_count?: number | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          status_updated_at?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pending_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_transactions: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          error_message: string | null
          id: string
          next_attempt_date: string | null
          payment_plan_id: string | null
          status: Database["public"]["Enums"]["transaction_status_type"]
          stripe_payment_intent_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          error_message?: string | null
          id?: string
          next_attempt_date?: string | null
          payment_plan_id?: string | null
          status: Database["public"]["Enums"]["transaction_status_type"]
          stripe_payment_intent_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          error_message?: string | null
          id?: string
          next_attempt_date?: string | null
          payment_plan_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status_type"]
          stripe_payment_intent_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_transactions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "pending_payment_plans"
            referencedColumns: ["id"]
          },
        ]
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
      profiles_backup: {
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
          id: string | null
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
          id?: string | null
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
          id?: string | null
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
      stripe_accounts_backup: {
        Row: {
          created_at: string | null
          id: string | null
          stripe_account_created_at: string | null
          stripe_account_details_url: string | null
          stripe_account_id: string | null
          stripe_onboarding_completed: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          stripe_account_created_at?: string | null
          stripe_account_details_url?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          last_reminder_email_log_id: string | null
          next_attempt_date: string | null
          paid_at: string | null
          payment_plan_id: string
          reminder_email_date: string | null
          status: string
          stripe_payment_intent_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id: string
          reminder_email_date?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id?: string
          reminder_email_date?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
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
        ]
      }
      transactions_backup: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string | null
          id: string | null
          is_downpayment: boolean | null
          last_reminder_email_log_id: string | null
          next_attempt_date: string | null
          paid_at: string | null
          payment_plan_id: string | null
          reminder_email_date: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          is_downpayment?: boolean | null
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id?: string | null
          reminder_email_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          is_downpayment?: boolean | null
          last_reminder_email_log_id?: string | null
          next_attempt_date?: string | null
          paid_at?: string | null
          payment_plan_id?: string | null
          reminder_email_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          activity_type: Database['public']['Enums']['activity_type']
          entity_type: string
          entity_id: string
          amount: number | null
          metadata: Json
          created_at: string
          customer_name: string | null
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: Database['public']['Enums']['activity_type']
          entity_type: string
          entity_id: string
          amount?: number | null
          metadata?: Json
          created_at?: string
          customer_name?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: Database['public']['Enums']['activity_type']
          entity_type?: string
          entity_id?: string
          amount?: number | null
          metadata?: Json
          created_at?: string
          customer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      complete_payment_plan_creation:
        | {
            Args: {
              p_payment_plan_id: string
              p_stripe_payment_intent_id: string
              p_idempotency_key: string
              p_card_last_four: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_payment_plan_id: string
              p_transaction_id: string
              p_idempotency_key: string
              p_card_last_four: string
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
      create_payment_plan_step1:
        | {
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
        | {
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
              p_idempotency_key: string
              p_notes?: Json
            }
            Returns: {
              payment_plan_id: string
              first_transaction_id: string
            }[]
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
      email_status_type: "sent" | "failed" | "bounced"
      email_type:
        | "customer_payment_plan_created"
        | "customer_payment_plan_ready"
        | "customer_payment_plan_modified"
        | "customer_payment_plan_approved"
        | "customer_payment_plan_rejected"
        | "customer_payment_link_sent"
        | "customer_payment_reminder"
        | "customer_payment_confirmation"
        | "customer_payment_failed"
        | "customer_payment_overdue"
        | "customer_payment_plan_completed"
        | "customer_card_expiring_soon"
        | "customer_card_expired"
        | "customer_card_update_needed"
        | "customer_card_updated"
        | "user_payment_plan_approved"
        | "user_payment_plan_rejected"
        | "user_payment_plan_modified"
        | "user_payment_failed_alert"
        | "user_payment_overdue_alert"
        | "user_daily_transactions_summary"
        | "user_weekly_transactions_summary"
        | "user_monthly_transactions_summary"
        | "user_account_created"
        | "user_account_verified"
        | "user_password_reset"
        | "user_login_alert"
        | "user_stripe_account_connected"
        | "user_stripe_account_updated"
      payment_interval_type: "weekly" | "monthly"
      payment_status_type:
        | "draft" // Initial state when plan is first created
        | "pending_approval" // After user completes setup and sends to customer
        | "pending_payment" // After customer approves but hasn't made first payment
        | "active" // Plan is active and payments are being processed
        | "paused" // Merchant has temporarily suspended payments
        | "completed" // All payments completed successfully
        | "cancelled" // Plan was cancelled by merchant or customer
        | "failed" // Plan failed due to payment issues
        | "ready_to_migrate" // First transaction successful, mark payment plan for migration to live
      payout_status_type:
        | "pending"
        | "in_transit"
        | "paid"
        | "failed"
        | "cancelled"
      processing_status_type: "started" | "completed" | "failed"
      transaction_status_type:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      transaction_type: "downpayment" | "installment"
      activity_type: 
        | 'payment_success'
        | 'payment_failed'
        | 'plan_created'
        | 'plan_activated'
        | 'plan_completed'
        | 'plan_cancelled'
        | 'payment_method_updated'
        | 'payout_scheduled'
        | 'payout_paid'
        | 'payout_failed'
        | 'email_sent'
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
