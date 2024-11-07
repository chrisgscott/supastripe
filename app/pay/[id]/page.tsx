import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { addWeeks, addMonths } from 'date-fns';
import { Money } from '@/utils/currencyUtils';
import PaymentPageClient from './PaymentPageClient';
import { Database } from '@/types/supabase';

type Transaction = Database['public']['Tables']['transactions']['Row'];

interface PaymentScheduleItem {
  date: string;
  amount: number;
  transaction_type: 'downpayment' | 'installment';
}

function calculatePaymentSchedule(
  totalAmount: Money,
  numberOfPayments: number,
  downpaymentAmount: Money,
  paymentInterval: Database['public']['Enums']['payment_interval_type'] = 'monthly'
): PaymentScheduleItem[] {
  const schedule: PaymentScheduleItem[] = [];
  let currentDate = new Date();

  // Add downpayment
  schedule.push({
    date: currentDate.toISOString(),
    amount: downpaymentAmount.toCents(),
    transaction_type: 'downpayment'
  });

  const remainingAmount = totalAmount.subtract(downpaymentAmount);
  const regularPaymentAmount = remainingAmount.divide(numberOfPayments - 1);
  let totalScheduled = downpaymentAmount;

  // Add remaining payments
  for (let i = 1; i < numberOfPayments; i++) {
    currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
    let paymentAmount = regularPaymentAmount;

    if (i === numberOfPayments - 1) {
      paymentAmount = totalAmount.subtract(totalScheduled);
    }

    schedule.push({
      date: currentDate.toISOString(),
      amount: paymentAmount.toCents(),
      transaction_type: 'installment'
    });

    totalScheduled = totalScheduled.add(paymentAmount);
  }

  return schedule;
}

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  
  // First try to fetch from payment_plans
  const { data: paymentPlan, error } = await supabase
    .from('payment_plans')
    .select(`
      *,
      customers (name, email),
      transactions (amount, due_date, transaction_type)
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

    if (pendingPlan.status !== 'pending_payment') {
      return redirect('/invalid-payment-link');
    }

    if (!pendingPlan.downpayment_amount) {
      return redirect('/invalid-payment-link');
    }

    const customerName = pendingPlan.pending_customers?.name || 'Unknown Customer';
    const customerEmail = pendingPlan.pending_customers?.email || '';
    const totalAmount = Money.fromCents(pendingPlan.total_amount);
    const downpaymentAmount = Money.fromCents(pendingPlan.downpayment_amount);

    const schedule = calculatePaymentSchedule(
      totalAmount,
      pendingPlan.number_of_payments,
      downpaymentAmount,
      pendingPlan.payment_interval
    );

    return (
      <PaymentPageClient 
        customerName={customerName}
        customerEmail={customerEmail}
        downpaymentAmount={pendingPlan.downpayment_amount}
        totalAmount={pendingPlan.total_amount}
        numberOfPayments={pendingPlan.number_of_payments}
        paymentPlanId={pendingPlan.id}
        paymentSchedule={schedule}
      />
    );
  }

  if (paymentPlan.status !== 'pending_payment') {
    return redirect('/invalid-payment-link');
  }

  const downpayment = paymentPlan.transactions.find(
    (t: Transaction) => t.transaction_type === 'downpayment'
  );
  
  if (!downpayment) {
    return redirect('/invalid-payment-link');
  }

  // Convert existing transactions to payment schedule format
  const schedule: PaymentScheduleItem[] = paymentPlan.transactions.map((t: {
    amount: number;
    due_date: string;
    transaction_type: 'downpayment' | 'installment';
  }) => ({
    date: t.due_date,
    amount: t.amount,
    transaction_type: t.transaction_type
  }));

  return (
    <PaymentPageClient 
      customerName={paymentPlan.customers?.name || 'Unknown Customer'}
      customerEmail={paymentPlan.customers?.email || ''}
      downpaymentAmount={downpayment.amount}
      totalAmount={paymentPlan.total_amount}
      numberOfPayments={paymentPlan.number_of_payments}
      paymentPlanId={paymentPlan.id}
      paymentSchedule={schedule}
    />
  );
}