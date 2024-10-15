// app/api/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { paymentPlanId } = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch the payment plan and its first transaction from the database
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select('*, transactions(*)')
      .eq('id', paymentPlanId)
      .single();

    if (paymentPlanError || !paymentPlan) {
      throw new Error('Payment plan not found');
    }

    const firstTransaction = paymentPlan.transactions[0];

    if (!firstTransaction) {
      throw new Error('No transactions found for this payment plan');
    }

    // Fetch the Stripe account ID for the user who created the payment plan
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', paymentPlan.user_id)
      .single();

    if (stripeAccountError || !stripeAccount) {
      throw new Error('Stripe account not found for the user');
    }

    // Create a PaymentIntent for the first transaction
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(firstTransaction.amount * 100),
      currency: 'usd',
      metadata: { 
        payment_plan_id: paymentPlanId,
        transaction_id: firstTransaction.id
      },
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
    });

    // Update the transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id
      })
      .eq('id', firstTransaction.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
