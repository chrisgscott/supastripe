import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { PlanDetails } from './PlanDetails'
import { Tables } from '@/types/supabase'

type Transaction = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  is_downpayment: boolean;
}

type PaymentPlanWithRelations = Tables<'payment_plans'> & {
  customers: {
    name: string;
    email: string;
  };
  transactions: Transaction[];
  notes?: {
    content: string;
    delta: any;
    plaintext: string;
  };
};

export default async function PlanPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

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
        is_downpayment
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !plan) {
    console.error('Error fetching plan:', error)
    notFound()
  }

  const typedPlan = plan as PaymentPlanWithRelations
  
  const planDetails = {
    customerName: typedPlan.customers?.name || 'Unknown',
    customerEmail: typedPlan.customers?.email || '',
    totalAmount: typedPlan.total_amount,
    numberOfPayments: typedPlan.number_of_payments,
    paymentInterval: typedPlan.payment_interval,
    paymentPlanId: typedPlan.id,
    notes: typedPlan.notes || undefined,
    paymentSchedule: typedPlan.transactions.map((t: Transaction) => ({
      amount: t.amount,
      date: t.due_date,
      is_downpayment: t.is_downpayment,
      status: t.status as 'paid' | 'pending'
    }))
  }

  return (
    <div className="container py-10">
      <PlanDetails planDetails={planDetails} />
    </div>
  )
}
