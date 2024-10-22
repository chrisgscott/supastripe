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

interface PaymentPlan {
  id: string;
  total_amount: number;
  user_id: string;
  // NOTE: This type definition allows for both single customer and array of customers
  // This flexibility is necessary due to how Supabase returns nested data
  customers: {
    id: string;
    stripe_customer_id: string;
    email: string;
  } | {
    id: string;
    stripe_customer_id: string;
    email: string;
  }[];
}
// IMPORTANT: When querying Supabase, use .single() to ensure customers is an object, not an array

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const { paymentPlanId, amount, firstTransactionId, isSetupIntent } = await request.json();
    console.log('Received request:', { paymentPlanId, amount, firstTransactionId, isSetupIntent });
    const supabase = createClient();

    // Fetch the payment plan data
    const { data: paymentPlan, error: fetchError } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        user_id,
        customers (id, stripe_customer_id, email)
      `)
      .eq('id', paymentPlanId)
      .single();

    if (fetchError || !paymentPlan) {
      console.error('Error fetching payment plan:', fetchError);
      throw new Error('Error fetching payment plan');
    }

    console.log('Fetched payment plan:', JSON.stringify(paymentPlan, null, 2));

    let stripeCustomerId: string | undefined;

    // IMPORTANT: This logic handles both single customer and array of customers
    // It's necessary because Supabase may return either format depending on the query
    if (paymentPlan.customers) {
      if (Array.isArray(paymentPlan.customers)) {
        stripeCustomerId = paymentPlan.customers[0]?.stripe_customer_id;
      } else {
        stripeCustomerId = (paymentPlan.customers as { stripe_customer_id: string }).stripe_customer_id;
      }
    }
    // NOTE: If you're consistently getting an array or object, consider updating the PaymentPlan interface
    // and this logic to match the actual data structure you're receiving from Supabase

    if (!stripeCustomerId) {
      console.error('Stripe customer ID not found for payment plan:', paymentPlan.id);
      throw new Error('Stripe customer ID not found');
    }

    console.log('Stripe Customer ID:', stripeCustomerId);

    // Fetch the user's Stripe account ID
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', paymentPlan.user_id)
      .single();

    if (stripeAccountError) {
      console.error('Error fetching Stripe account:', stripeAccountError);
      throw new Error('Error fetching Stripe account');
    }

    if (!stripeAccount?.stripe_account_id) {
      console.error('Stripe account ID not found for user:', paymentPlan.user_id);
      throw new Error('Stripe account not connected for this user');
    }

    console.log('Fetched Stripe account:', JSON.stringify(stripeAccount, null, 2));

    if (isSetupIntent) {
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
      });

      return NextResponse.json({ clientSecret: setupIntent.client_secret });
    } else {
      // Calculate platform fee
      const platformFee = Math.round(amount * platformFeePercentage);

      // Create PaymentIntent on the platform account
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          payment_plan_id: paymentPlan.id,
          transaction_id: firstTransactionId,
        },
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
        setup_future_usage: 'off_session',
      });

      console.log('Created PaymentIntent:', JSON.stringify(paymentIntent, null, 2));

      return NextResponse.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    }
  } catch (error) {
    console.error('Error in create-payment-intent:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
  }
}
