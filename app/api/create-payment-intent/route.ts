import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import { calculateApplicationFee } from '@/utils/feeUtils';
import { Money } from '@/utils/currencyUtils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { amount, paymentPlanId, setupFutureUsage } = await request.json();

    // Fetch the pending plan and associated customer
    const { data: pendingPlan, error: planError } = await supabase
      .from('pending_payment_plans')
      .select(`
        *,
        pending_customers (
          name,
          email
        ),
        user_id
      `)
      .eq('id', paymentPlanId)
      .single();

    if (planError || !pendingPlan) {
      throw new Error('Payment plan not found');
    }

    // Get the Stripe account ID for the merchant
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', pendingPlan.user_id)
      .single();

    if (stripeAccountError || !stripeAccount) {
      throw new Error('Stripe account not found');
    }

    // Create or retrieve Stripe customer
    const existingCustomers = await stripe.customers.list({
      email: pendingPlan.pending_customers.email,
      limit: 1
    });

    const customer = existingCustomers.data.length > 0
      ? existingCustomers.data[0]
      : await stripe.customers.create({
          name: pendingPlan.pending_customers.name,
          email: pendingPlan.pending_customers.email,
        });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: setupFutureUsage,
      application_fee_amount: calculateApplicationFee(Money.fromCents(amount)),
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        pending_payment_plan_id: paymentPlanId,
        transaction_type: 'downpayment',
        pending_transaction_id: paymentPlanId
      }
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}