import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Tables } from '@/types/supabase'

interface PendingPlan {
  id: string
  customerName: string
  totalAmount: number
  created_at: string
}

type PendingPlanWithCustomer = Tables<'pending_payment_plans'> & {
  pending_customers: Tables<'pending_customers'>[]
}

export async function GET() {
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
        created_at,
        pending_customers!customer_id (
          name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch pending plans' }, { status: 500 })
    }

    const formattedData: PendingPlan[] = (data as PendingPlanWithCustomer[]).map((plan) => ({
      id: plan.id,
      customerName: plan.pending_customers[0]?.name || 'Unknown',
      totalAmount: plan.total_amount || 0,
      created_at: plan.created_at || new Date().toISOString()
    }));

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
