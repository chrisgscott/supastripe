// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const MAX_RECORDS_PER_EXECUTION = 100;

serve(async (req: Request) => {
  console.log('Function started');

  if (!Deno.env.get('STRIPE_SECRET_KEY')) {
    console.error('STRIPE_SECRET_KEY is not set in the environment variables');
    return new Response(JSON.stringify({ error: 'Stripe configuration error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const currentDate = new Date().toISOString().split('T')[0];

    // Get due transactions
    const { data: dueTransactions, error } = await supabase
      .from('transactions')
      .select('*, payment_plans(user_id, customer_id)')
      .eq('status', 'pending')
      .lte('due_date', currentDate)
      .limit(MAX_RECORDS_PER_EXECUTION);

    if (error) throw error;

    console.log(`Found ${dueTransactions?.length || 0} due transactions to process`);

    const results = await Promise.allSettled(dueTransactions.map(async (transaction) => {
      const idempotencyKey = `process_payment_${transaction.id}_${currentDate}`;

      // Check if this transaction has already been processed today
      const { data: existingLog } = await supabase
        .from('payment_processing_logs')
        .select()
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingLog) {
        console.log(`Transaction ${transaction.id} already processed today`);
        return;
      }

      try {
        // Get the customer's payment method
        const { data: customer } = await supabase
          .from('customers')
          .select('stripe_customer_id')
          .eq('id', transaction.payment_plans.customer_id)
          .single();

        if (!customer?.stripe_customer_id) {
          throw new Error(`No Stripe customer found for customer ID: ${transaction.payment_plans.customer_id}`);
        }

        // Retrieve the customer's saved payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customer.stripe_customer_id,
          type: 'card',
        });

        if (paymentMethods.data.length === 0) {
          throw new Error(`No saved payment methods found for customer ID: ${transaction.payment_plans.customer_id}`);
        }

        // Use the first saved payment method
        const paymentMethod = paymentMethods.data[0];

        // Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: transaction.amount,
          currency: 'usd',
          customer: customer.stripe_customer_id,
          payment_method: paymentMethod.id,
          off_session: true,
          confirm: true,
          metadata: {
            transaction_id: transaction.id,
            payment_plan_id: transaction.payment_plan_id,
            transaction_type: 'installment'
          },
        });

        // Update the transaction with the PaymentIntent ID
        await supabase
          .from('transactions')
          .update({ 
            stripe_payment_intent_id: paymentIntent.id,
            status: 'processing'
          })
          .eq('id', transaction.id);

        // Log the successful payment intent creation attempt
        await supabase
          .from('payment_processing_logs')
          .insert({
            transaction_id: transaction.id,
            status: 'payment_intent_created',
            stripe_payment_intent_id: paymentIntent.id,
            idempotency_key: idempotencyKey
          });

        console.log(`Created PaymentIntent ${paymentIntent.id} for transaction ${transaction.id}`);
      } catch (err) {
        console.error(`Error processing transaction ${transaction.id}:`, err);

        // Log the failed processing attempt
        await supabase
          .from('payment_processing_logs')
          .insert({
            transaction_id: transaction.id,
            status: 'failed',
            error_message: err.message,
            error_details: JSON.stringify(err),
            idempotency_key: idempotencyKey
          });

        // Update the transaction status to 'failed'
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);
      }
    }));

    // Count successful and failed payment processing attempts
    const failedCount = results.filter(result => result.status === 'rejected').length;
    const successCount = results.length - failedCount;

    // Check if there are more records to process
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('due_date', currentDate);

    if (countError) {
      console.error('Error getting total count:', countError);
    }

    const hasMoreRecords = (count || 0) > dueTransactions.length;

    // Return the results
    return new Response(JSON.stringify({ 
      message: 'Due payments processed',
      successCount,
      failedCount,
      processedCount: dueTransactions.length,
      hasMoreRecords
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error occurred' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
