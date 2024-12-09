import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";
import crypto from "crypto";
import { PostgrestError } from '@supabase/supabase-js';
import { PaymentEvents } from '@/utils/events';

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

  console.log('[Payment Confirmation] Starting payment confirmation:', {
    paymentIntentId,
    timestamp: new Date().toISOString()
  });

  if (!paymentIntentId) {
    console.log('handle-payment-confirmation: No payment_intent provided');
    return NextResponse.json({
      success: false,
      error: 'Payment intent ID is required'
    }, { status: 400 });
  }

  try {
    // First, check if this payment intent has already been processed
    const { data: existingTransaction, error: existingTransactionError } = await supabase
      .from('transactions')
      .select('payment_plan_id, stripe_payment_intent_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    console.log('[Payment Confirmation] Existing transaction check:', {
      paymentIntentId,
      found: !!existingTransaction,
      transactionDetails: existingTransaction,
      timestamp: new Date().toISOString()
    });

    if (existingTransaction) {
      console.log('handle-payment-confirmation: Payment already processed, redirecting to:', existingTransaction.payment_plan_id);
      return NextResponse.json({
        success: true,
        redirectUrl: `/plan/${existingTransaction.payment_plan_id}`
      });
    }

    console.log('handle-payment-confirmation: Fetching Stripe payment intent');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method']
    });
    console.log('handle-payment-confirmation: Retrieved payment intent:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });

    if (!paymentIntent) {
      console.error('Payment confirmation: Payment intent not found:', paymentIntentId);
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
    }

    console.log('Payment confirmation: Retrieved payment intent', {
      id: paymentIntentId,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      created_at: new Date(paymentIntent.created * 1000).toISOString()
    });

    // Only check status, don't migrate - migration will be handled by webhook
    if (paymentIntent.status === 'succeeded') {
      console.log('Payment confirmation: Payment succeeded, checking for completed transaction');
      
      // Look for a transaction with this payment intent ID
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          payment_plan_id,
          created_at,
          updated_at,
          status,
          transaction_type
        `)
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (transactionError) {
        console.error('Payment confirmation: Error checking transaction:', transactionError);
        return NextResponse.json({ error: 'Error checking payment status' }, { status: 500 });
      }

      // If we found a transaction, the webhook has already processed this payment
      if (transaction?.payment_plan_id) {
        console.log('Payment confirmation: Found completed transaction', {
          payment_plan_id: transaction.payment_plan_id,
          transaction_created_at: transaction.created_at,
          transaction_updated_at: transaction.updated_at,
          status: transaction.status,
          type: transaction.transaction_type,
          webhook_processing_time_ms: transaction.updated_at ? 
            new Date(transaction.updated_at).getTime() - new Date(paymentIntent.created * 1000).getTime() : 
            null
        });

        return NextResponse.json({
          success: true,
          redirectUrl: `/plan/${transaction.payment_plan_id}`
        });
      }

      // If no transaction yet, the webhook hasn't processed it - return success but keep polling
      console.log('Payment confirmation: No transaction found yet, webhook processing in progress');
      return NextResponse.json({ success: true });
    }

    console.log('Payment confirmation: Payment not completed', { 
      status: paymentIntent.status 
    });
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
  } catch (error) {
    console.error('Error in handle-payment-confirmation:', error);

    const isPgError = (err: unknown): err is PostgrestError =>
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      'details' in err;

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