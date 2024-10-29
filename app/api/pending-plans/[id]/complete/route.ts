import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addWeeks, addMonths } from 'date-fns'
import { Money } from '@/utils/currencyUtils'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { numberOfPayments, paymentInterval } = await request.json()

  try {
    // Fetch the pending plan
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('id', params.id)
      .eq('plan_creation_status', 'pending')
      .single()

    if (planError) throw planError

    // Calculate payment amounts and dates
    const totalAmount = plan.total_amount
    const paymentAmount = Math.floor(totalAmount / numberOfPayments)
    const remainder = totalAmount % numberOfPayments
    
    const transactions = Array.from({ length: numberOfPayments }, (_, index) => {
      const dueDate = paymentInterval === 'weekly' 
        ? addWeeks(new Date(), index + 1)
        : addMonths(new Date(), index + 1)

      return {
        payment_plan_id: plan.id,
        amount: index === 0 ? paymentAmount + remainder : paymentAmount,
        due_date: dueDate.toISOString(),
        status: 'pending'
      }
    })

    // Insert transactions
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert(transactions)

    if (transactionError) throw transactionError

    // Update plan status
    const { error: updateError } = await supabase
      .from('payment_plans')
      .update({ 
        plan_creation_status: 'completed',
        status: 'active',
        number_of_payments: numberOfPayments,
        payment_interval: paymentInterval
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to complete payment plan setup' },
      { status: 500 }
    )
  }
}