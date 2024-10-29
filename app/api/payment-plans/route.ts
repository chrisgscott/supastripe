import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addWeeks, addMonths, format } from 'date-fns'
import { Tables } from '@/types/supabase'
import { Money } from '@/utils/currencyUtils'

type PaymentPlanWithRelations = Tables<'payment_plans'> & {
  customers: {
    name: string;
    email: string;
  };
  transactions: {
    due_date: string;
    status: string;
  }[];
};

export async function GET() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        status,
        created_at,
        customers (
          name,
          email
        ),
        transactions (
          due_date,
          status
        )
      `)
      .eq('plan_creation_status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
    }

    console.log('Raw data from Supabase:', JSON.stringify(data, null, 2))

    const formattedData = (data as unknown as PaymentPlanWithRelations[]).map((plan) => {
      const nextPaymentDate = calculateNextPaymentDate(plan);
      const formattedPlan = {
        id: plan.id,
        customerName: plan.customers?.name || 'Unknown',
        totalAmount: Money.fromCents(plan.total_amount).toString(),
        nextPaymentDate,
        status: plan.status,
        created_at: plan.created_at
      };
      return formattedPlan;
    });

    console.log('Final formatted data:', JSON.stringify(formattedData, null, 2))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

function calculateNextPaymentDate(plan: any) {
  const pendingTransactions = plan.transactions.filter((t: any) => t.status === 'pending')
  if (pendingTransactions.length === 0) return null

  const nextDueDate = new Date(Math.min(...pendingTransactions.map((t: any) => new Date(t.due_date).getTime())))
  return format(nextDueDate, 'yyyy-MM-dd')
}
