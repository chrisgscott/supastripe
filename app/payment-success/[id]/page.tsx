import { redirect } from 'next/navigation';
import { PaymentSuccessClient } from './PaymentSuccessClient';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { payment_intent?: string };
}) {
  const paymentIntentId = searchParams.payment_intent;
  if (!paymentIntentId) {
    redirect('/dashboard');
  }

  // Call cookies() to opt out of caching
  cookies()
  const supabase = await createClient()

  // Use getUser() for secure token validation
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/sign-in')
  }

  try {
    // First try to fetch from payment_plans
    const { data: paymentPlan, error: paymentPlanError } = await supabase
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
        console.error('Error fetching pending payment plan:', pendingError);
        redirect('/dashboard');
      }

      // Get payment intent details from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const stripeMetadata = paymentIntent.metadata || {};

      return (
        <PaymentSuccessClient
          planId={pendingPlan.id}
          customerName={pendingPlan.pending_customers.name}
          customerEmail={pendingPlan.pending_customers.email}
          totalAmount={paymentIntent.amount}
          numberOfPayments={parseInt(paymentIntent.metadata.number_of_payments)}
          paymentInterval={paymentIntent.metadata.payment_interval}
          track={stripeMetadata.track as string}
          metadata={stripeMetadata}
        />
      );
    }

    // Get payment intent details from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const stripeMetadata = paymentIntent.metadata || {};

    return (
      <PaymentSuccessClient
        planId={paymentPlan.id}
        customerName={paymentPlan.customers.name}
        customerEmail={paymentPlan.customers.email}
        totalAmount={paymentIntent.amount}
        numberOfPayments={parseInt(paymentIntent.metadata.number_of_payments)}
        paymentInterval={paymentIntent.metadata.payment_interval}
        track={stripeMetadata.track as string}
        metadata={stripeMetadata}
      />
    );
  } catch (error) {
    console.error('Error in payment success page:', error);
    redirect('/dashboard');
  }
}