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

    const { paymentPlanId, transactionId } = body;

    if (!paymentPlanId) {
      console.error('create-payment-intent: No paymentPlanId provided');
      return NextResponse.json({ error: 'No paymentPlanId provided' }, { status: 400 });
    }

    console.log('create-payment-intent: Fetching payment plan data');
    const supabase = createClient();

    // Fetch the payment plan and its transactions
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

    // If transactionId is not provided, we're just fetching the payment plan data
    if (!transactionId) {
      return NextResponse.json(paymentPlan);
    }

    const transaction = paymentPlan.transactions.find((t: Transaction) => t.is_downpayment);
    if (!transaction) {
      throw new Error('Downpayment transaction not found');
    }

    console.log('create-payment-intent: Transaction data:', transaction);
    if (!transaction.user_id) {
      throw new Error('Transaction does not have a user_id');
    }

    // Fetch the customer information from the payment plan data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', paymentPlan.customer_id)
      .single();

    console.log('create-payment-intent: Fetched customer data:', customer);

    if (customerError || !customer) {
      console.error('create-payment-intent: Customer not found');
      throw new Error('Customer not found for this payment plan');
    }

    // Fetch or create a Stripe Customer
    let stripeCustomer;
    if (!customer.stripe_customer_id) {
      stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: customer.name,
        metadata: {
          user_id: customer.user_id
        }
      });

      // Update the customer with the Stripe customer ID
      await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq('id', customer.id);
    } else {
      stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id) as Stripe.Customer;
    }

    console.log('create-payment-intent: Stripe customer:', stripeCustomer);

    // Fetch the Stripe account ID for the user who created the payment plan
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', transaction.user_id)
      .single();

    console.log('create-payment-intent: Fetching Stripe account for user:', transaction.user_id);

    if (stripeAccountError || !stripeAccount) {
      throw new Error('Stripe account not found for the user');
    }

    console.log('create-payment-intent: Stripe account:', stripeAccount);

    // Calculate the platform fee
    const platformFee = Math.round(transaction.amount * 100 * platformFeePercentage);

    // Check if a PaymentIntent already exists for this transaction
    const existingTransaction = await supabase
      .from('transactions')
      .select('stripe_payment_intent_id')
      .eq('id', transaction.id)
      .single();

    if (existingTransaction.data?.stripe_payment_intent_id) {
      // If a PaymentIntent already exists, retrieve it
      const existingPaymentIntent = await stripe.paymentIntents.retrieve(existingTransaction.data.stripe_payment_intent_id);
      return NextResponse.json({ clientSecret: existingPaymentIntent.client_secret });
    }

    // If no PaymentIntent exists, create a new one
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(transaction.amount * 100), // Convert to cents and ensure it's an integer
      currency: 'usd',
      customer: stripeCustomer.id,
      metadata: {
        payment_plan_id: paymentPlanId,
        transaction_id: transactionId,
        customer_name: customer.name,
        customer_email: customer.email
      },
      capture_method: 'automatic',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      payment_method_types: ['card'],
    });

    // Update the transaction with the new PaymentIntent ID
    await supabase
      .from('transactions')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', transaction.id);

    console.log('create-payment-intent: PaymentIntent created:', paymentIntent.id);

    console.log('create-payment-intent: Returning client secret');
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('create-payment-intent: Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
