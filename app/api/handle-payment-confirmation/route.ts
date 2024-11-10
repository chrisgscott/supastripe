import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";
import crypto from "crypto";
import { PostgrestError } from '@supabase/supabase-js';

type TransactionStatusType = Database['public']['Enums']['transaction_status_type'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];
type PendingTransaction = Database['public']['Tables']['pending_transactions']['Row'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

interface StructuredError {
  name?: string;
  message: string;
  code?: string;
  details?: string;
  stack?: string;
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('payment_intent');

  console.log('handle-payment-confirmation: Starting with payment_intent:', paymentIntentId);

  if (!paymentIntentId) {
    console.log('handle-payment-confirmation: No payment_intent provided');
    return NextResponse.json({
      success: false,
      error: 'Payment intent ID is required'
    }, { status: 400 });
  }

  try {
    // First, check if this payment intent has already been processed
    const { data: existingPlan, error: existingPlanError } = await supabase
      .from('payment_plans')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existingPlan) {
      console.log('handle-payment-confirmation: Payment already processed, redirecting to:', existingPlan.id);
      return NextResponse.json({
        success: true,
        redirectUrl: `/plan/${existingPlan.id}`
      });
    }

    console.log('handle-payment-confirmation: Fetching Stripe payment intent');
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method']
    });
    console.log('handle-payment-confirmation: Retrieved payment intent:', {
      id: stripePaymentIntent.id,
      status: stripePaymentIntent.status,
      metadata: stripePaymentIntent.metadata
    });

    const pendingPlanId = stripePaymentIntent.metadata?.pending_payment_plan_id;
    console.log('handle-payment-confirmation: Extracted pending_plan_id:', pendingPlanId);
    
    if (!pendingPlanId) {
      throw new Error('Pending payment plan ID not found in payment intent metadata');
    }

    console.log('handle-payment-confirmation: Fetching pending plan');
    const { data: pendingPlan, error: planError } = await supabase
      .from('pending_payment_plans')
      .select(`
        *,
        pending_customers (
          name,
          email
        )
      `)
      .eq('id', pendingPlanId)
      .single();

    if (planError) {
      console.error('handle-payment-confirmation: Error fetching pending plan:', planError);
      throw planError;
    }
    console.log('handle-payment-confirmation: Retrieved pending plan:', pendingPlan);

    // Get card details from the payment method
    const paymentMethod = stripePaymentIntent.payment_method as Stripe.PaymentMethod;
    const cardDetails = {
      card_last_four: paymentMethod.card?.last4,
      card_expiration: `${paymentMethod.card?.exp_month}/${paymentMethod.card?.exp_year}`
    };

    console.log('handle-payment-confirmation: Calling handle_payment_confirmation RPC');
    const { data: result, error: migrationError } = await supabase
      .rpc('handle_payment_confirmation', {
        p_pending_plan_id: pendingPlanId,
        p_payment_intent_id: paymentIntentId,
        p_idempotency_key: crypto.randomUUID(),
        p_card_last_four: cardDetails.card_last_four,
        p_card_expiration: cardDetails.card_expiration
      });

    console.log('handle-payment-confirmation: RPC result:', result);
    console.log('handle-payment-confirmation: RPC error:', migrationError);

    if (migrationError) {
      console.error('Migration error:', migrationError);
      throw migrationError;
    }

    if (!result || !result.success) {
      console.error('handle-payment-confirmation: Migration failed:', result);
      throw new Error(result?.error || 'Migration failed');
    }

    console.log('handle-payment-confirmation: Verifying migrated plan');
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
      .eq('id', result.migrated_plan_id)
      .single();

    if (verificationError || !newPlan) {
      console.error('handle-payment-confirmation: Verification failed:', { verificationError, newPlan });
      throw new Error('Failed to verify migrated payment plan');
    }

    // Log the successful payment
    const activityLog = {
      activity_type: 'payment_success',
      entity_id: result.migrated_plan_id,
      entity_type: 'payment_plan',
      amount: pendingPlan.total_amount,
      customer_name: pendingPlan.pending_customers.name,
      user_id: pendingPlan.user_id,
      metadata: {
        payment_intent_id: paymentIntentId,
        customer_email: pendingPlan.pending_customers.email
      }
    };

    const { error: logError } = await supabase
      .from('activity_logs')
      .insert(activityLog);

    if (logError) {
      console.error('Error logging payment activity:', logError);
    }

    console.log('handle-payment-confirmation: Successfully completed migration');
    return NextResponse.json({
      success: true,
      redirectUrl: `/plan/${result.migrated_plan_id}`
    });

  } catch (error) {
    console.error('Error in handle-payment-confirmation:', error);
    
    const isPgError = (err: unknown): err is PostgrestError => 
      err !== null && 
      typeof err === 'object' && 
      'code' in err &&
      'details' in err;
    
    // If it's a "no rows returned" error and we've already processed this payment
    if (isPgError(error) && error.code === 'PGRST116') {
      console.log('handle-payment-confirmation: Pending plan not found, checking for existing processed payment');
      
      try {
        // Try to find the processed payment plan using transactions
        const { data: processedPlan, error: lookupError } = await supabase
          .from('transactions')
          .select('payment_plan_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single();

        if (lookupError) {
          console.error('Error looking up processed payment:', lookupError);
          throw lookupError;
        }

        if (processedPlan) {
          console.log('handle-payment-confirmation: Found existing processed payment:', processedPlan.payment_plan_id);
          return NextResponse.json({
            success: true,
            redirectUrl: `/payment-success/${processedPlan.payment_plan_id}`
          });
        }
      } catch (lookupError) {
        console.error('Error checking for processed payment:', lookupError);
      }
    }

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      ...(isPgError(error) && {
        code: error.code,
        details: error.details
      })
    };
    
    console.error('Error details:', errorDetails);
    
    return NextResponse.json({
      success: false,
      error: errorDetails.message,
      details: isPgError(error) ? errorDetails : undefined
    }, { status: 500 });
  }
}