import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PaymentSuccessClient } from './PaymentSuccessClient';

export default async function PaymentSuccessPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // First try to fetch from payment_plans
  const { data: paymentPlan, error } = await supabase
    .from('payment_plans')
    .select(`
      *,
      customers (
        name,
        email
      )
    `)
    .eq('id', params.id)
    .single();

  // If not found in payment_plans, try pending_payment_plans
  if (!paymentPlan) {
    const { data: pendingPlan, error: pendingError } = await supabase
      .from('pending_payment_plans')
      .select(`
        *,
        pending_customers!inner (
          name,
          email
        )
      `)
      .eq('id', params.id)
      .single();

    if (pendingError || !pendingPlan) {
      return redirect('/404');
    }

    return (
      <PaymentSuccessClient 
        planId={pendingPlan.id}
        customerName={pendingPlan.pending_customers.name}
        customerEmail={pendingPlan.pending_customers.email}
        totalAmount={pendingPlan.total_amount}
        numberOfPayments={pendingPlan.number_of_payments}
        paymentInterval={pendingPlan.payment_interval}
      />
    );
  }

  return (
    <PaymentSuccessClient 
      planId={paymentPlan.id}
      customerName={paymentPlan.customers[0].name}
      customerEmail={paymentPlan.customers[0].email}
      totalAmount={paymentPlan.total_amount}
      numberOfPayments={paymentPlan.number_of_payments}
      paymentInterval={paymentPlan.payment_interval}
    />
  );
}