import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: paymentPlans, error } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        status,
        customers!inner (
          name,
          email
        ),
        transactions (
          amount,
          status,
          due_date
        )
      `)
      .eq('user_id', user.id)

    if (error) throw error

    const formattedPaymentPlans = paymentPlans.map(plan => {
      const customer = Array.isArray(plan.customers) ? plan.customers[0] : plan.customers

      const nextPayment = plan.transactions
        .filter(t => t.status === 'pending')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

      return {
        id: plan.id,
        customerName: customer?.name || 'Unknown',
        customerEmail: customer?.email || 'Unknown',
        totalAmount: plan.total_amount,
        nextPaymentDate: nextPayment ? nextPayment.due_date : null,
        status: plan.status,
      }
    })

    return NextResponse.json(formattedPaymentPlans)
  } catch (error) {
    console.error('Error fetching payment plans:', error)
    return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
  }
}
