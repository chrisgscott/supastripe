// app/api/update-payment-status/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error('No Stripe signature found in the request');
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    const supabase = createClient();

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, supabase);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Error processing webhook: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const transactionId = paymentIntent.metadata.transaction_id;

  if (!transactionId) {
    console.error('No transaction ID found in metadata');
    return;
  }

  console.log(`Processing successful payment for transaction ${transactionId}`);

  // Update the transaction status in the database
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ 
      status: 'paid'
    })
    .eq('id', transactionId);

  if (updateError) {
    console.error(`Error updating transaction status for ${transactionId}:`, updateError);
    return;
  }

  // Check if this was the last payment in the plan
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select('*, payment_plans(*)')
    .eq('id', transactionId)
    .single();

  if (transactionError) {
    console.error(`Error fetching transaction ${transactionId}:`, transactionError);
    return;
  }

  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact' })
    .eq('payment_plan_id', transaction.payment_plan_id)
    .eq('status', 'pending');

  console.log(`Remaining pending transactions for payment plan ${transaction.payment_plan_id}: ${count}`);

  let newPlanStatus = transaction.payment_plans.status;

  if (count === 0) {
    newPlanStatus = 'completed';
  } else if (transaction.payment_plans.status === 'pending') {
    newPlanStatus = 'active';
  }

  if (newPlanStatus !== transaction.payment_plans.status) {
    console.log(`Updating payment plan ${transaction.payment_plan_id} status to ${newPlanStatus}`);
    const { error: planUpdateError } = await supabase
      .from('payment_plans')
      .update({ status: newPlanStatus })
      .eq('id', transaction.payment_plan_id);

    if (planUpdateError) {
      console.error(`Error updating payment plan ${transaction.payment_plan_id} status:`, planUpdateError);
      return;
    }
  }

  console.log(`Successfully processed payment for transaction ${transactionId}`);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const transactionId = paymentIntent.metadata.transaction_id;

  if (!transactionId) {
    console.error('No transaction ID found in metadata for failed payment');
    return;
  }

  console.log(`Processing failed payment for transaction ${transactionId}`);

  // Update the transaction status to 'failed' in the database
  const { error: failedUpdateError } = await supabase
    .from('transactions')
    .update({ 
      status: 'failed'
    })
    .eq('id', transactionId);

  if (failedUpdateError) {
    console.error(`Error updating failed transaction status for ${transactionId}:`, failedUpdateError);
    return;
  }

  // Fetch the payment plan ID associated with this transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select('payment_plan_id')
    .eq('id', transactionId)
    .single();

  if (transactionError) {
    console.error(`Error fetching transaction ${transactionId}:`, transactionError);
    return;
  }

  // Update the payment plan status to 'failed'
  const { error: failedPlanUpdateError } = await supabase
    .from('payment_plans')
    .update({ status: 'failed' })
    .eq('id', transaction.payment_plan_id);

  if (failedPlanUpdateError) {
    console.error(`Error updating failed payment plan status for ${transaction.payment_plan_id}:`, failedPlanUpdateError);
    return;
  }

  console.log(`Successfully processed failed payment for transaction ${transactionId}`);
}
