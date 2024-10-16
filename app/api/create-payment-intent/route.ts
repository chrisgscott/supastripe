// app/api/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

// Set the platform fee (our fee) to 2%
const platformFeePercentage = 0.02;

interface Transaction {
  id: string;
  status: string;
  amount: number;
  payment_plans: {
    user_id: string;
  };
  is_downpayment: boolean;
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return '127.0.0.1';
}

export async function POST(request: Request) {
  console.log('create-payment-intent: Received request');
  try {
    const body = await request.json();
    console.log('create-payment-intent: Request body:', body);

    const { paymentPlanId } = body;

    if (!paymentPlanId) {
      console.error('create-payment-intent: No paymentPlanId provided');
      return NextResponse.json({ error: 'No paymentPlanId provided' }, { status: 400 });
    }

    console.log('create-payment-intent: Fetching payment plan data');
    const supabase = createClient();

    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select('*, transactions(*), customers(*)')
      .eq('id', paymentPlanId)
      .single();

    if (paymentPlanError) {
      console.error('create-payment-intent: Payment plan not found');
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    console.log('create-payment-intent: Payment plan data:', paymentPlan);

    const downpaymentTransaction = paymentPlan.transactions.find((t: Transaction) => t.is_downpayment);

    if (!downpaymentTransaction) {
      console.error('create-payment-intent: No downpayment transaction found');
      return NextResponse.json({ error: 'No downpayment transaction found' }, { status: 400 });
    }

    console.log('create-payment-intent: Payment plan data:', paymentPlan);
    console.log('create-payment-intent: Downpayment transaction:', downpaymentTransaction);

    const amount = Math.round(downpaymentTransaction.amount * 100);
    const applicationFeeAmount = Math.round(amount * platformFeePercentage);
    console.log('create-payment-intent: Amount:', amount);
    console.log('create-payment-intent: Application fee amount:', applicationFeeAmount);

    // Fetch the connected Stripe account ID for the user
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', paymentPlan.user_id)
      .single();

    if (stripeAccountError || !stripeAccount?.stripe_account_id) {
      console.error('create-payment-intent: No Stripe account found for user');
      return NextResponse.json({ error: 'No Stripe account found for user' }, { status: 400 });
    }

    console.log('create-payment-intent: Stripe account:', stripeAccount);

    console.log('create-payment-intent: Creating payment intent');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Already in cents
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        payment_plan_id: paymentPlanId,
        transaction_id: downpaymentTransaction.id,
      },
    });

    console.log('create-payment-intent: PaymentIntent created:', paymentIntent.id);

    // Update the transaction with the new PaymentIntent ID
    await supabase
      .from('transactions')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', downpaymentTransaction.id);

    console.log('create-payment-intent: Returning client secret');
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('create-payment-intent: Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
