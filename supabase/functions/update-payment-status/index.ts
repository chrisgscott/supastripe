// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'
import { corsHeaders } from '../_shared/cors.ts'
import * as crypto from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// Types
type TransactionStatusType = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
type TransactionType = 'downpayment' | 'installment';

type EventType = 
  | 'payment_confirmed'
  | 'payment_failed'
  | 'payment_refunded'
  | 'plan_activated'
  | 'plan_completed'
  | 'plan_cancelled';

type ActivityType = 
  | 'payment_method_updated'
  | 'payment_success'
  | 'payment_failed'
  | 'plan_created'
  | 'email_sent'
  | 'plan_activated'
  | 'plan_completed'
  | 'plan_cancelled'
  | 'payout_scheduled'
  | 'payout_paid'
  | 'payout_failed';

// Environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  Deno.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
      }
    });
  }

  try {
    console.log('Function started');
    console.log('Request method:', req.method);
    console.log('Headers received:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    // For Stripe webhooks, we don't need authorization header
    // We verify the request using the Stripe signature instead
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No Stripe signature found in the request');
      return new Response(
        JSON.stringify({ error: 'No stripe signature found' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.text();
    console.log('Received webhook body:', body);

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        stripeWebhookSecret
      );
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing webhook event:', event.type);
    console.log('Event data:', JSON.stringify(event.data, null, 2));

    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};

    async function publishEvent(
      eventType: EventType,
      entityType: 'payment_plan' | 'payment',
      entityId: string,
      userId: string,
      metadata: any = {},
      customerId?: string
    ) {
      const { error } = await supabase.rpc('publish_activity', {
        p_event_type: eventType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_user_id: userId,
        p_metadata: metadata,
        p_customer_id: customerId
      });

      if (error) {
        console.error('Failed to publish event:', error);
        throw error;
      }
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(paymentIntent, supabase);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(paymentIntent, supabase);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Error processing webhook:', {
      error: err,
      message: err.message,
      stack: err.stack,
    });
    return new Response(
      JSON.stringify({ error: 'Error processing webhook', details: err.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const metadata = paymentIntent.metadata || {};
  const { user_id, customer_id } = metadata;

  console.log('Processing successful payment:', paymentIntent.id);

  try {
    // Check if this payment has already been processed
    const { data: existingTransaction, error: queryError } = await supabase
      .from('transactions')
      .select('id, payment_plan_id, status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (queryError) {
      console.error('Error checking existing transaction:', queryError);
      throw queryError;
    }

    if (existingTransaction?.status === 'completed') {
      console.log('Payment already processed successfully:', paymentIntent.id);
      return;
    }

    // Check pending transactions too
    const { data: pendingTransaction, error: pendingError } = await supabase
      .from('pending_transactions')
      .select('id, payment_plan_id, status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (pendingError) {
      console.error('Error checking pending transaction:', pendingError);
      throw pendingError;
    }

    if (pendingTransaction?.status === 'completed') {
      console.log('Payment already processed in pending:', paymentIntent.id);
      return;
    }

    // Use the handle_payment_confirmation RPC function
    console.log('Calling handle_payment_confirmation for success');
    const { data: result, error: confirmationError } = await supabase.rpc('handle_payment_confirmation', {
      payment_intent_id: paymentIntent.id,
      payment_status: 'succeeded'
    });

    if (confirmationError) {
      console.error('Error handling payment confirmation:', confirmationError);
      throw confirmationError;
    }

    console.log('Payment confirmation result:', result);

    // Publish payment confirmation event if we have the necessary IDs
    if (result?.success && user_id) {
      try {
        await publishEvent(
          'payment_confirmed',
          'payment',
          paymentIntent.id,
          user_id,
          {
            amount: paymentIntent.amount,
            payment_method: paymentIntent.payment_method_types?.[0],
            status: 'succeeded'
          },
          customer_id
        );
      } catch (eventError) {
        // Log but don't throw - event publishing is non-critical
        console.error('Error publishing payment confirmation event:', eventError);
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentIntentSucceeded:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const metadata = paymentIntent.metadata || {};
  const { user_id, customer_id } = metadata;
  const lastError = paymentIntent.last_payment_error;
  const errorMessage = lastError ? `${lastError.code}: ${lastError.message}` : 'Unknown error';

  console.log('Processing failed payment:', paymentIntent.id);

  try {
    // Check if this failure has already been processed
    const { data: existingTransaction, error: queryError } = await supabase
      .from('transactions')
      .select('id, payment_plan_id, status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (queryError) {
      console.error('Error checking existing transaction:', queryError);
      throw queryError;
    }

    if (existingTransaction?.status === 'failed') {
      console.log('Payment failure already processed:', paymentIntent.id);
      return;
    }

    // Check pending transactions too
    const { data: pendingTransaction, error: pendingError } = await supabase
      .from('pending_transactions')
      .select('id, payment_plan_id, status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (pendingError) {
      console.error('Error checking pending transaction:', pendingError);
      throw pendingError;
    }

    if (pendingTransaction?.status === 'failed') {
      console.log('Payment failure already processed in pending:', paymentIntent.id);
      return;
    }

    // Use the handle_payment_confirmation RPC function
    console.log('Calling handle_payment_confirmation for failure');
    const { data: result, error: confirmationError } = await supabase.rpc('handle_payment_confirmation', {
      payment_intent_id: paymentIntent.id,
      payment_status: 'failed',
      error_message: errorMessage
    });

    if (confirmationError) {
      console.error('Error handling payment failure:', confirmationError);
      throw confirmationError;
    }

    console.log('Payment failure result:', result);

    // Publish payment failed event if we have the necessary IDs
    if (user_id) {
      try {
        await publishEvent(
          'payment_failed',
          'payment',
          paymentIntent.id,
          user_id,
          {
            amount: paymentIntent.amount,
            error: errorMessage,
            payment_method: paymentIntent.payment_method_types?.[0],
            status: 'failed'
          },
          customer_id
        );
      } catch (eventError) {
        // Log but don't throw - event publishing is non-critical
        console.error('Error publishing payment failure event:', eventError);
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentIntentFailed:', error);
    throw error;
  }
}

async function handleAccountUpdated(account: Stripe.Account, supabase: any) {
  console.log(`Updating account ${account.id}`)

  const { error: stripeAccountError } = await supabase
    .from('stripe_accounts')
    .update({
      stripe_onboarding_completed: account.details_submitted,
      stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
    })
    .eq('stripe_account_id', account.id)

  if (stripeAccountError) {
    console.error(`Error updating stripe_accounts for account ${account.id}:`, stripeAccountError)
    throw stripeAccountError
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      business_name: account.business_profile?.name || null,
      business_url: account.business_profile?.url || null,
      support_phone: account.business_profile?.support_phone || null,
      support_email: account.business_profile?.support_email || account.email || null,
      is_onboarded: account.details_submitted,
    })
    .eq('stripe_account_id', account.id)

  if (profileError) {
    console.error(`Error updating profiles for account ${account.id}:`, profileError)
    throw profileError
  }

  console.log(`Successfully updated account ${account.id}`)
}

async function handlePayout(payout: Stripe.Payout, supabase: any, connectedAccountId: string) {
  console.log(`Processing payout ${payout.id} for account ${connectedAccountId}`)

  const { error: upsertError } = await supabase
    .from('payouts')
    .upsert({
      stripe_payout_id: payout.id,
      stripe_account_id: connectedAccountId,
      amount: payout.amount / 100,
      currency: payout.currency,
      status: payout.status,
      arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
    })

  if (upsertError) {
    console.error(`Error upserting payout ${payout.id}:`, upsertError)
    throw upsertError
  }

  console.log(`Successfully processed payout ${payout.id}`)
}

async function handleReview(review: Stripe.Review, supabase: any, connectedAccountId: string) {
  console.log(`Processing review ${review.id} for account ${connectedAccountId}`)

  const { error: upsertError } = await supabase
    .from('stripe_reviews')
    .upsert({
      stripe_review_id: review.id,
      stripe_account_id: connectedAccountId,
      reason: review.reason,
      status: review.closed ? 'closed' : 'open',
      opened_at: new Date(review.created * 1000).toISOString(),
      closed_at: review.closed ? new Date(review.closed * 1000).toISOString() : null,
    })

  if (upsertError) {
    console.error(`Error upserting review ${review.id}:`, upsertError)
    throw upsertError
  }

  console.log(`Successfully processed review ${review.id}`)
}

async function handleTransfer(transfer: Stripe.Transfer, supabase: any) {
  const transactionId = transfer.metadata.transaction_id

  if (!transactionId) {
    throw new Error('No transaction ID found in transfer metadata')
  }

  console.log(`Processing transfer ${transfer.id} for transaction ${transactionId}`)

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ 
      stripe_transfer_id: transfer.id,
      transfer_amount: transfer.amount / 100
    })
    .eq('id', transactionId)

  if (updateError) {
    console.error(`Error updating transaction ${transactionId} with transfer information:`, updateError)
    throw updateError
  }

  console.log(`Successfully processed transfer ${transfer.id}`)
}
