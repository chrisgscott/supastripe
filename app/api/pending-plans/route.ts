import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Tables } from '@/types/supabase'
import { Money } from '@/utils/currencyUtils'

type PaymentPlanWithRelations = Tables<'payment_plans'> & {
  customers: {
    name: string;
    email: string;
  };
  payment_plan_states: {
    status: string;
  }[];
};

export async function GET() {
  const supabase = createClient()

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        created_at,
        customers (
          name,
          email
        ),
        payment_plan_states (
          status
        )
      `)
      .eq('payment_plan_states.status', 'draft')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch pending plans' }, { status: 500 })
    }

    const formattedData = (data as unknown as PaymentPlanWithRelations[]).map((plan) => ({
      id: plan.id,
      customerName: plan.customers?.name || 'Unknown',
      totalAmount: plan.total_amount,
      status: plan.payment_plan_states?.[0]?.status || 'unknown',
      created_at: plan.created_at
    }));

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
