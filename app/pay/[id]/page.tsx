import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import PaymentPageClient from './PaymentPageClient';

interface Transaction {
  amount: number;
  due_date: string;
  is_downpayment: boolean;
}

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: paymentPlan, error } = await supabase
    .from('payment_plans')
    .select(`
      *,
      customers (name, email),
      transactions (amount, due_date, is_downpayment),
      payment_plan_states (status)
    `)
    .eq('id', params.id)
    .single();

  if (error || !paymentPlan) {
    redirect('/404');
  }

  if (paymentPlan.payment_plan_states?.status !== 'pending_payment') {
    redirect('/invalid-payment-link');
  }

  const downpayment = paymentPlan.transactions.find((t: Transaction) => t.is_downpayment);
  if (!downpayment) {
    redirect('/invalid-payment-link');
  }

  return (
    <div className="container max-w-2xl py-8">
      <PaymentPageClient 
        customerName={paymentPlan.customers.name}
        downpaymentAmount={downpayment.amount}
        totalAmount={paymentPlan.total_amount}
        numberOfPayments={paymentPlan.number_of_payments}
      />
    </div>
  );
}