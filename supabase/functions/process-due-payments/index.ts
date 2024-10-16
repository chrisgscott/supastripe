// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

Deno.serve(async () => {
  try {
    // Get all due transactions
    const { data: dueTransactions, error } = await supabase
      .from('transactions')
      .select('*, payment_plans(user_id, customer_id)')
      .eq('status', 'pending')
      .lte('due_date', new Date().toISOString())

    if (error) throw error

    for (const transaction of dueTransactions) {
      try {
        // Get the customer's payment method
        const { data: customer } = await supabase
          .from('customers')
          .select('stripe_customer_id')
          .eq('id', transaction.payment_plans.customer_id)
          .single()

        if (!customer?.stripe_customer_id) {
          throw new Error(`No Stripe customer found for customer ID: ${transaction.payment_plans.customer_id}`)
        }

        // Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(transaction.amount * 100), // amount in cents
          currency: 'usd',
          customer: customer.stripe_customer_id,
          metadata: {
            transaction_id: transaction.id,
            payment_plan_id: transaction.payment_plan_id,
          },
        })

        // Update the transaction with the PaymentIntent ID
        await supabase
          .from('transactions')
          .update({ stripe_payment_intent_id: paymentIntent.id })
          .eq('id', transaction.id)

        console.log(`Created PaymentIntent ${paymentIntent.id} for transaction ${transaction.id}`)
      } catch (err) {
        console.error(`Error processing transaction ${transaction.id}:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error processing due payments:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-due-payments' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
