// app/api/update-payment-status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature') as string;
  const connectedAccountId = request.headers.get('stripe-account') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const transactionId = paymentIntent.metadata.transaction_id;

      if (!transactionId) {
        return NextResponse.json({ error: 'No transaction ID found in metadata' }, { status: 400 });
      }

      // Update the transaction status in the database
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          stripe_account_id: connectedAccountId
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Error updating transaction status:', updateError);
        return NextResponse.json({ error: 'Error updating transaction status' }, { status: 500 });
      }

      // Check if this was the last payment in the plan
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*, payment_plans(*)')
        .eq('id', transactionId)
        .single();

      if (transactionError) {
        console.error('Error fetching transaction:', transactionError);
        return NextResponse.json({ error: 'Error fetching transaction' }, { status: 500 });
      }

      const remainingPayments = await supabase
        .from('transactions')
        .select('id')
        .eq('payment_plan_id', transaction.payment_plan_id)
        .eq('status', 'pending');

      if (remainingPayments.count === 0) {
        // This was the last payment, update the payment plan status to completed
        const { error: planUpdateError } = await supabase
          .from('payment_plans')
          .update({ status: 'completed' })
          .eq('id', transaction.payment_plan_id);

        if (planUpdateError) {
          console.error('Error updating payment plan status:', planUpdateError);
          return NextResponse.json({ error: 'Error updating payment plan status' }, { status: 500 });
        }
      } else if (transaction.status === 'pending') {
        // This is the first payment, update the payment plan status to active
        const { error: planUpdateError } = await supabase
          .from('payment_plans')
          .update({ status: 'active' })
          .eq('id', transaction.payment_plan_id);

        if (planUpdateError) {
          console.error('Error updating payment plan status:', planUpdateError);
          return NextResponse.json({ error: 'Error updating payment plan status' }, { status: 500 });
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      const failedTransactionId = failedPaymentIntent.metadata.transaction_id;

      if (!failedTransactionId) {
        return NextResponse.json({ error: 'No transaction ID found in metadata' }, { status: 400 });
      }

      // Update the transaction status to 'failed' in the database
      const { data: failedTransaction, error: failedUpdateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          stripe_account_id: connectedAccountId
        })
        .eq('id', failedTransactionId)
        .select('payment_plan_id')
        .single();

      if (failedUpdateError) {
        console.error('Error updating failed transaction status:', failedUpdateError);
        return NextResponse.json({ error: 'Error updating failed transaction status' }, { status: 500 });
      }

      // Update the payment plan status to 'failed'
      const { error: failedPlanUpdateError } = await supabase
        .from('payment_plans')
        .update({ status: 'failed' })
        .eq('id', failedTransaction.payment_plan_id);

      if (failedPlanUpdateError) {
        console.error('Error updating failed payment plan status:', failedPlanUpdateError);
        return NextResponse.json({ error: 'Error updating failed payment plan status' }, { status: 500 });
      }
      break;
  }

  return NextResponse.json({ received: true });
}
