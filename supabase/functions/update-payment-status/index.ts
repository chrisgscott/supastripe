// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'

// Remove these imports as they're not needed or accessible in the edge function
// import { Money } from '@/utils/currencyUtils';
// import { Tables } from '@/types/supabase';

// Instead, we can define the types we need directly here
type TransactionStatusType = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
type TransactionType = 'downpayment' | 'installment';

// Add the ActivityType enum at the top of the file
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

type Transaction = Tables<'transactions'>;

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  console.log('Received webhook request with headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

  if (!signature) {
    console.error('No Stripe signature found in the request');
    return new Response('No signature', { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const body = await req.text();
    console.log('Received webhook body:', body);

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      stripeWebhookSecret
    );

    console.log(`Received webhook event: ${event.type}`);
    console.log('Event data:', JSON.stringify(event.data, null, 2));

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, supabase);
        break;
      case 'transfer.created':
        await handleTransfer(event.data.object as Stripe.Transfer, supabase);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    clearTimeout(timeoutId);
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Error processing webhook:', {
      error: err,
      message: err.message,
      stack: err.stack,
      details: err.details,
      hint: err.hint,
      code: err.code
    });
    return new Response(
      JSON.stringify({ error: 'Error processing webhook', details: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  console.log('Handling successful PaymentIntent:', paymentIntent);

  const transactionId = paymentIntent.metadata.transaction_id || 
                       paymentIntent.metadata.pending_transaction_id;
  const paymentPlanId = paymentIntent.metadata.payment_plan_id;

  if (!transactionId && !paymentPlanId) {
    console.error('No transaction ID or payment plan ID found in metadata:', paymentIntent.metadata);
    throw new Error('No transaction ID or payment plan ID found in metadata');
  }

  // If we have a payment plan ID but no transaction ID, we need to look up the transaction
  if (!transactionId && paymentPlanId) {
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_plan_id', paymentPlanId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !transaction) {
      console.error('Error fetching transaction for payment plan:', fetchError);
      throw new Error('Could not find pending transaction for payment plan');
    }

    transactionId = transaction.id;
  }

  console.log(`Processing successful payment for transaction ${transactionId}`);

  // Remove p_status parameter since it's not part of the stored procedure
  const { data, error } = await supabase.rpc('handle_successful_payment', {
    p_transaction_id: transactionId,
    p_paid_at: new Date().toISOString()
  });

  if (error) {
    console.error(`Error processing successful payment for transaction ${transactionId}:`, error);
    throw error;
  }

  // Now that the transaction exists, we can log to payment_processing_logs
  const { error: logError } = await supabase
    .from('payment_processing_logs')
    .upsert({
      transaction_id: transactionId,
      status: 'payment_succeeded',
      stripe_payment_intent_id: paymentIntent.id,
      idempotency_key: `payment_succeeded_${transactionId}_${paymentIntent.id}`
    });

  if (logError) {
    console.error(`Error logging successful payment for transaction ${transactionId}:`, logError);
    // Note: We're not throwing here to avoid breaking the main flow if logging fails
  }

  // After transaction is created/updated, fetch its details for activity logging
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select(`
      amount,
      payment_plan_id,
      payment_plans!inner (
        id,
        user_id,
        customers!inner (
          name
        )
      )
    `)
    .eq('id', transactionId)
    .single();

  if (fetchError) {
    console.error(`Error fetching transaction details for logging:`, fetchError);
  } else {
    // Log the activity
    const activityLogData = {
      activity_type: 'payment_success' as ActivityType,
      entity_id: transaction.payment_plans.id,
      entity_type: 'payment_plan',
      user_id: transaction.payment_plans.user_id,
      customer_name: transaction.payment_plans.customers.name,
      amount: transaction.amount,
      metadata: {
        payment_intent_id: paymentIntent.id,
        transaction_id: transactionId
      }
    };

    console.log('Activity log data:', {
      rawData: activityLogData,
      activityTypeValue: activityLogData.activity_type,
      activityTypeType: typeof activityLogData.activity_type
    });

    const { error: activityLogError } = await supabase
      .from('activity_logs')
      .insert(activityLogData);

    if (activityLogError) {
      console.error('Error logging payment success activity:', activityLogError);
      // Log the SQL query if possible
      console.log('Activity log error details:', {
        code: activityLogError.code,
        message: activityLogError.message,
        details: activityLogError.details,
        hint: activityLogError.hint
      });
    }
  }

  console.log(`Successfully processed payment for transaction ${transactionId}`, data);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const transactionId = paymentIntent.metadata.transaction_id || paymentIntent.metadata.pending_transaction_id;

  if (!transactionId) {
    throw new Error('No transaction ID found in metadata');
  }

  console.log(`Processing failed payment for transaction ${transactionId}`);

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ 
      status: 'failed',
      next_attempt_date: paymentIntent.next_payment_attempt 
        ? new Date(paymentIntent.next_payment_attempt * 1000).toISOString() 
        : null
    })
    .eq('id', transactionId)

  if (updateError) {
    console.error(`Error updating transaction ${transactionId}:`, updateError)
    throw updateError
  }

  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      payment_plan_id,
      payment_plans!inner (
        user_id,
        customers!inner (
          name
        )
      )
    `)
    .eq('id', transactionId)
    .single();

  if (fetchError) {
    console.error(`Error fetching transaction details for logging:`, fetchError);
  } else {
    // Log the activity
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        activity_type: 'payment_failed' as ActivityType,
        entity_id: transaction.payment_plan_id,
        entity_type: 'payment_plan',
        user_id: transaction.payment_plans.user_id,
        customer_name: transaction.payment_plans.customers.name,
        amount: transaction.amount,
        metadata: {
          payment_intent_id: paymentIntent.id,
          transaction_id: transactionId,
          failure_message: paymentIntent.last_payment_error?.message
        }
      });

    if (logError) {
      console.error('Error logging payment failure activity:', logError);
    }
  }

  console.log(`Successfully processed failed payment for transaction ${transactionId}`)
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
