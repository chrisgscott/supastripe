import { NextResponse } from 'next/server'
import { createClient } from "@/utils/supabase/server";
import { Database } from '@/types/supabase'

type PaymentIntervalType = Database['public']['Enums']['payment_interval_type']
type PaymentStatusType = Database['public']['Enums']['payment_status_type']
type TransactionStatusType = Database['public']['Enums']['transaction_status_type']
type TransactionType = Database['public']['Enums']['transaction_type']

interface PendingPlanResponse {
  id: string;
  customer_id: string;
  user_id: string;
  total_amount: number;
  downpayment_amount: number;
  number_of_payments: number;
  payment_interval: PaymentIntervalType;
  status: PaymentStatusType;
  created_at: string | null;
  notes: JSON | null;
  idempotency_key: string | null;
  card_last_four: string | null;
  card_expiration_month: number | null;
  card_expiration_year: number | null;
  change_request_notes: string | null;
  last_reminder_sent_at: string | null;
  payment_link_expires_at: string | null;
  payment_link_token: string | null;
  reminder_count: number | null;
  status_updated_at: string | null;
  updated_at: string | null;
  pending_customers: {
    id: string;
    name: string;
    email: string;
    user_id: string;
    stripe_customer_id: string;
  };
  pending_transactions: {
    id: string;
    payment_plan_id: string | null;
    amount: number;
    due_date: string;
    status: TransactionStatusType;
    transaction_type: TransactionType;
    stripe_payment_intent_id: string | null;
    error_message: string | null;
    next_attempt_date: string | null;
    created_at: string | null;
  }[];
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('pending_payment_plans')
      .select(`
        id,
        customer_id,
        user_id,
        total_amount,
        downpayment_amount,
        number_of_payments,
        payment_interval,
        status,
        created_at,
        notes,
        idempotency_key,
        card_last_four,
        card_expiration_month,
        card_expiration_year,
        change_request_notes,
        last_reminder_sent_at,
        payment_link_expires_at,
        payment_link_token,
        reminder_count,
        status_updated_at,
        updated_at,
        pending_customers!customer_id (
          id,
          name,
          email,
          user_id,
          stripe_customer_id
        ),
        pending_transactions (
          id,
          payment_plan_id,
          amount,
          due_date,
          status,
          transaction_type,
          stripe_payment_intent_id,
          error_message,
          next_attempt_date,
          created_at
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const formattedData: PendingPlanResponse = {
      ...data,
      pending_customers: data.pending_customers[0]
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch plan details' }, { status: 500 });
  }
}
