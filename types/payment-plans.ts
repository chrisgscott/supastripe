import { Database } from './supabase'

type PaymentStatusType = Database['public']['Enums']['payment_status_type']

export interface Customer {
  id: string;
  name: string;
  email?: string;
}

export interface PaymentPlan {
  id: string;
  total_amount: number;
  created_at: string;
  status: PaymentStatusType;
  customer_id: string;
  customer: Customer;
  transactions: Array<{
    due_date: string;
    status: string;
  }>;
}

export interface PaymentPlanListResponse {
  id: string;
  total_amount: number;
  created_at: string;
  status: PaymentStatusType;
  customer_id: string;
  customers: Customer[];
  transactions: Array<{
    due_date: string;
    status: string;
  }>;
}