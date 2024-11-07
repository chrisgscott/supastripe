import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import { PlanDetails } from './PlanDetails'

type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

export default async function PlanPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const supabase = createClient()

  try {
    const { data: plan, error } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          name,
          email
        ),
        transactions (
          id,
          amount,
          due_date,
          status,
          transaction_type,
          stripe_payment_intent_id,
          created_at,
          updated_at
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching plan:', error)
      throw error
    }

    if (!plan) {
      return notFound()
    }

    const transformedPlan = {
      customerName: plan.customers?.name || '',
      customerEmail: plan.customers?.email || '',
      totalAmount: plan.total_amount,
      numberOfPayments: plan.number_of_payments,
      paymentInterval: plan.payment_interval,
      paymentSchedule: plan.transactions.map((t: Transaction) => ({
        amount: t.amount,
        date: t.due_date,
        status: t.status,
        transaction_type: t.transaction_type,
        cardLastFour: plan.card_last_four
      })),
      paymentPlanId: plan.id,
      paymentMethod: plan.card_last_four ? {
        brand: 'card',
        last4: plan.card_last_four
      } : undefined,
      notes: plan.notes,
      status: plan.status
    }

    return <PlanDetails planDetails={transformedPlan} />
  } catch (error) {
    console.error('Error fetching plan:', error)
    throw error
  }
}
