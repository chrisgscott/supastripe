import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addWeeks, addMonths, format } from 'date-fns'

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
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
    }

    const formattedData = data.map((plan: any) => {
      const nextPaymentDate = calculateNextPaymentDate(plan)
      return {
        id: plan.id,
        customerName: plan.customers[0]?.name || 'Unknown',
        totalAmount: plan.total_amount,
        nextPaymentDate,
        status: plan.status,
        created_at: plan.created_at
      }
    })

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
