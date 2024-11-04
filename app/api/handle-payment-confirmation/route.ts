import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";
import crypto from "crypto";

type TransactionStatusType = Database['public']['Enums']['transaction_status_type'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];
type PendingTransaction = Database['public']['Tables']['pending_transactions']['Row'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('payment_intent');

  if (!paymentIntentId) {
    return NextResponse.json({
      success: false,
      error: 'Payment intent ID is required'
    }, { status: 400 });
  }

  try {
    // Begin transaction
    await supabase.rpc('begin_transaction');

    try {
      // Fetch the Stripe payment intent
      const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['payment_method']
      });

      const pendingPlanId = stripePaymentIntent.metadata?.pending_payment_plan_id;
      
      if (!pendingPlanId) {
        throw new Error('Pending payment plan ID not found in payment intent metadata');
      }

      // Get the pending payment plan
      const { data: pendingPlan, error: planError } = await supabase
        .from('pending_payment_plans')
        .select(`
          *,
          pending_customers (
            name,
            email
          ),
          pending_transactions (*)
        `)
        .eq('id', pendingPlanId)
        .single();

      if (planError) throw planError;

      // Update the first transaction status to completed
      const { data: firstTransaction, error: transactionError } = await supabase
        .from('pending_transactions')
        .update({ 
          status: 'completed' as TransactionStatusType,
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId
        })
        .eq('payment_plan_id', pendingPlanId)
        .eq('transaction_type', 'downpayment')
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update the pending payment plan status
      const { error: planUpdateError } = await supabase
        .from('pending_payment_plans')
        .update({ 
          status: 'ready_to_migrate' as PaymentStatusType,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', pendingPlanId);

      if (planUpdateError) throw planUpdateError;

      // Create email log for successful payment
      const idempotencyKey = crypto.randomUUID();
      const { error: emailLogError } = await supabase
        .from('email_logs')
        .insert({
          email_type: 'payment_confirmation',
          status: 'pending',
          related_id: firstTransaction.id,
          related_type: 'transaction',
          idempotency_key: idempotencyKey,
          recipient_email: pendingPlan.pending_customers.email,
          user_id: pendingPlan.user_id
        });

      if (emailLogError) throw emailLogError;

      // Migrate the data
      const { data: migratedPlanId, error: migrationError } = await supabase
        .rpc('migrate_pending_payment_plan', {
          p_pending_plan_id: pendingPlanId
        });

      if (migrationError) throw migrationError;

      // Verify the migration was successful by checking the live tables
      const { data: newPlan, error: verificationError } = await supabase
        .from('payment_plans')
        .select(`
          id,
          customers (
            name,
            email
          ),
          transactions (*)
        `)
        .eq('id', migratedPlanId)
        .single();

      if (verificationError || !newPlan) {
        throw new Error('Failed to verify migrated payment plan');
      }

      // Clean up pending records
      const { error: cleanupError } = await supabase.rpc('cleanup_pending_payment_records', {
        p_pending_plan_id: pendingPlanId
      });

      if (cleanupError) {
        console.error('Warning: Failed to cleanup pending records:', cleanupError);
        // Don't throw error here, as migration was successful
      }

      // Commit transaction
      await supabase.rpc('commit_transaction');

      return NextResponse.json({
        success: true,
        redirectUrl: `/plan/${migratedPlanId}`
      });

    } catch (innerError) {
      // Rollback on any error
      await supabase.rpc('rollback_transaction');
      throw innerError;
    }

  } catch (error) {
    console.error('Error in handle-payment-confirmation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}