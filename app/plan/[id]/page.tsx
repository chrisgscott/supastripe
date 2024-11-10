import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import { PlanDetails } from './PlanDetails'

type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type PendingPaymentPlan = Database['public']['Tables']['pending_payment_plans']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type PendingTransaction = Database['public']['Tables']['pending_transactions']['Row'];

export default async function PlanPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const supabase = createClient()

  try {
    // First try regular payment plans
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          name,
          email
        ),
        transactions (*)
      `)
      .eq('id', id)
      .maybeSingle()

    if (planError && planError.code !== 'PGRST116') {
      throw planError
    }

    // If not found, try pending payment plans
    if (!plan) {
      const { data: pendingPlan, error: pendingError } = await supabase
        .from('pending_payment_plans')
        .select(`
          *,
          pending_customers (
            name,
            email
          ),
          pending_transactions (*)
        `)
        .eq('id', id)
        .maybeSingle()

      if (pendingError) {
        throw pendingError
      }

      if (!pendingPlan) {
        return notFound()
      }

      // Transform pending plan data
      const transformedPlan = {
        customerName: pendingPlan.pending_customers?.name || '',
        customerEmail: pendingPlan.pending_customers?.email || '',
        totalAmount: pendingPlan.total_amount,
        numberOfPayments: pendingPlan.number_of_payments,
        paymentInterval: pendingPlan.payment_interval,
        paymentSchedule: pendingPlan.pending_transactions.map((t: PendingTransaction) => ({
          amount: t.amount,
          date: t.due_date,
          status: t.status,
          transaction_type: t.transaction_type,
          cardLastFour: pendingPlan.card_last_four
        })),
        paymentPlanId: pendingPlan.id,
        paymentMethod: pendingPlan.card_last_four ? {
          brand: 'card',
          last4: pendingPlan.card_last_four,
          cardExpiration: pendingPlan.card_expiration
        } : undefined,
        notes: pendingPlan.notes,
        status: pendingPlan.status,
        isPending: true
      }

      return <PlanDetails planDetails={transformedPlan} />
    }

    // Transform regular plan data
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
        last4: plan.card_last_four,
        cardExpiration: plan.card_expiration
      } : undefined,
      notes: plan.notes,
      status: plan.status,
      isPending: false,
      cardLastFour: plan.card_last_four,
      cardExpiration: plan.card_expiration
    }

    return <PlanDetails planDetails={transformedPlan} />
  } catch (error) {
    console.error('Error fetching plan:', error)
    throw error
  }
}
