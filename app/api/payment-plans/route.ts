import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { Database } from '@/types/supabase'
import { Money, formatCurrency } from '@/utils/currencyUtils'

interface PaymentPlan {
  id: string;
  customerName: string;
  totalAmount: string;
  nextPaymentDate: string | null;
  status: string;
  created_at: string;
}

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
        created_at,
        status,
        customer:customers!customer_id (
          name
        ),
        transactions (
          due_date,
          status
        )
      `)
      .eq('user_id', user.id)
      .neq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
    }

    const formattedData: PaymentPlan[] = data.map((plan) => ({
      id: plan.id,
      customerName: plan.customer[0]?.name || 'Unknown',
      totalAmount: formatCurrency(Money.fromCents(plan.total_amount || 0)),
      nextPaymentDate: calculateNextPaymentDate(plan.transactions),
      status: plan.status,
      created_at: plan.created_at
    }));

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

function calculateNextPaymentDate(transactions: any[]): string | null {
  if (!transactions || transactions.length === 0) return null
  
  const pendingTransactions = transactions.filter(t => t.status === 'pending')
  if (pendingTransactions.length === 0) return null

  const nextDueDate = new Date(Math.min(...pendingTransactions.map(t => new Date(t.due_date).getTime())))
  return format(nextDueDate, 'yyyy-MM-dd')
}
