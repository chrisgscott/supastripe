import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PaymentSuccessClient } from './PaymentSuccessClient';

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { payment_intent: string };
}) {
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

    const { payment_intent: paymentIntentId } = searchParams;
  
    // Get payment intent details from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const { track, metadata } = paymentIntent.metadata || {};

    return (
      <PaymentSuccessClient 
        planId={pendingPlan.id}
        customerName={paymentIntent.metadata.customer_name}
        customerEmail={paymentIntent.metadata.customer_email}
        totalAmount={paymentIntent.amount}
        numberOfPayments={parseInt(paymentIntent.metadata.number_of_payments)}
        paymentInterval={paymentIntent.metadata.payment_interval}
        track={track}
        metadata={metadata}
      />
    );
  }

  const { payment_intent: paymentIntentId } = searchParams;
  
  // Get payment intent details from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const { track, metadata } = paymentIntent.metadata || {};

  return (
    <PaymentSuccessClient 
      planId={paymentPlan.id}
      customerName={paymentIntent.metadata.customer_name}
      customerEmail={paymentIntent.metadata.customer_email}
      totalAmount={paymentIntent.amount}
      numberOfPayments={parseInt(paymentIntent.metadata.number_of_payments)}
      paymentInterval={paymentIntent.metadata.payment_interval}
      track={track}
      metadata={metadata}
    />
  );
}