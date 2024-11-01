import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Database } from '@/types/supabase'

type PaymentInterval = Database['public']['Enums']['payment_interval_type']

interface PendingPlanResponse {
  id: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  numberOfPayments: number;
  paymentInterval: PaymentInterval;
  downpaymentAmount: number;
}

type PendingPlanWithCustomer = {
  id: string;
  total_amount: number;
  number_of_payments: number;
  payment_interval: PaymentInterval;
  downpayment_amount: number;
  created_at: string | null;
  notes: any;
  pending_customers: {
    name: string;
    email: string;
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
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        created_at,
        notes,
        pending_customers!customer_id (
          name,
          email
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const formattedData: PendingPlanResponse = {
      id: data.id,
      customerName: data.pending_customers[0]?.name || 'Unknown',
      customerEmail: data.pending_customers[0]?.email || '',
      totalAmount: data.total_amount,
      numberOfPayments: data.number_of_payments,
      paymentInterval: data.payment_interval,
      downpaymentAmount: data.downpayment_amount
    }

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch plan details' }, { status: 500 })
  }
}
