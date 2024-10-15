// @ts-nocheck
// supabase/functions/update-payment-status/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
})

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  )

  const payload = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  const connectedAccountId = req.headers.get('stripe-account') as string

  let event

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') as string
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const transactionId = paymentIntent.metadata.transaction_id

      if (!transactionId) {
        return new Response(JSON.stringify({ error: 'No transaction ID found in metadata' }), { status: 400 })
      }

      // Update the transaction status in the database
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          stripe_account_id: connectedAccountId
        })
        .eq('id', transactionId)

      if (updateError) {
        console.error('Error updating transaction status:', updateError)
        return new Response(JSON.stringify({ error: 'Error updating transaction status' }), { status: 500 })
      }

      // Check if this was the last payment in the plan
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*, payment_plans(*)')
        .eq('id', transactionId)
        .single()

      if (transactionError) {
        console.error('Error fetching transaction:', transactionError)
        return new Response(JSON.stringify({ error: 'Error fetching transaction' }), { status: 500 })
      }

      const { count, error: remainingPaymentsError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('payment_plan_id', transaction.payment_plan_id)
        .eq('status', 'pending')

      if (remainingPaymentsError) {
        console.error('Error checking remaining payments:', remainingPaymentsError)
        return new Response(JSON.stringify({ error: 'Error checking remaining payments' }), { status: 500 })
      }

      if (count === 0) {
        // This was the last payment, update the payment plan status
        const { error: planUpdateError } = await supabase
          .from('payment_plans')
          .update({ status: 'completed' })
          .eq('id', transaction.payment_plan_id)

        if (planUpdateError) {
          console.error('Error updating payment plan status:', planUpdateError)
          return new Response(JSON.stringify({ error: 'Error updating payment plan status' }), { status: 500 })
        }
      }

      if (transaction.status === 'pending') {
        await supabase
          .from('payment_plans')
          .update({ status: 'active' })
          .eq('id', transaction.payment_plan_id);
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent
      const failedTransactionId = failedPaymentIntent.metadata.transaction_id

      if (!failedTransactionId) {
        return new Response(JSON.stringify({ error: 'No transaction ID found in metadata' }), { status: 400 })
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
        .single()

      if (failedUpdateError) {
        console.error('Error updating failed transaction status:', failedUpdateError)
        return new Response(JSON.stringify({ error: 'Error updating failed transaction status' }), { status: 500 })
      }

      // Update the payment plan status to 'failed'
      const { error: failedPlanUpdateError } = await supabase
        .from('payment_plans')
        .update({ status: 'failed' })
        .eq('id', failedTransaction.payment_plan_id)

      if (failedPlanUpdateError) {
        console.error('Error updating failed payment plan status:', failedPlanUpdateError)
        return new Response(JSON.stringify({ error: 'Error updating failed payment plan status' }), { status: 500 })
      }

      break;

    case 'charge.refunded':
      const refund = event.data.object as Stripe.Refund
      const refundedChargeId = refund.charge as string
      
      // Find the transaction associated with this charge
      const { data: refundedTransaction, error: refundedTransactionError } = await supabase
        .from('transactions')
        .select('id')
        .eq('stripe_charge_id', refundedChargeId)
        .single()

      if (refundedTransactionError) {
        console.error('Error finding refunded transaction:', refundedTransactionError)
        return new Response(JSON.stringify({ error: 'Error finding refunded transaction' }), { status: 500 })
      }

      // Update the transaction status to 'refunded'
      const { error: refundUpdateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'refunded',
          refund_amount: refund.amount / 100 // Convert cents to dollars
        })
        .eq('id', refundedTransaction.id)

      if (refundUpdateError) {
        console.error('Error updating refunded transaction:', refundUpdateError)
        return new Response(JSON.stringify({ error: 'Error updating refunded transaction' }), { status: 500 })
      }
      break;

    case 'account.updated':
      const updatedAccount = event.data.object as Stripe.Account
      
      // Update the stripe_accounts table
      const { error: accountUpdateError } = await supabase
        .from('stripe_accounts')
        .update({
          stripe_onboarding_completed: updatedAccount.details_submitted,
          stripe_account_details_url: `https://dashboard.stripe.com/${updatedAccount.id}`,
        })
        .eq('stripe_account_id', updatedAccount.id)

      if (accountUpdateError) {
        console.error('Error updating Stripe account details:', accountUpdateError)
        return new Response(JSON.stringify({ error: 'Error updating Stripe account details' }), { status: 500 })
      }

      // Update the profiles table
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          business_name: updatedAccount.business_profile?.name || null,
          business_url: updatedAccount.business_profile?.url || null,
          business_phone: updatedAccount.business_profile?.support_phone || null,
          business_email: updatedAccount.email || null,
          is_onboarded: updatedAccount.details_submitted,
        })
        .eq('stripe_account_id', updatedAccount.id)

      if (profileUpdateError) {
        console.error('Error updating profile with business information:', profileUpdateError)
        return new Response(JSON.stringify({ error: 'Error updating profile with business information' }), { status: 500 })
      }
      break;

    case 'payout.created':
    case 'payout.paid':
    case 'payout.failed':
      const payout = event.data.object as Stripe.Payout
      
      // Update or create a record in a new 'payouts' table
      const { error: payoutUpsertError } = await supabase
        .from('payouts')
        .upsert({
          stripe_payout_id: payout.id,
          stripe_account_id: connectedAccountId,
          amount: payout.amount / 100, // Convert cents to dollars
          currency: payout.currency,
          status: payout.status,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        })

      if (payoutUpsertError) {
        console.error('Error upserting payout:', payoutUpsertError)
        return new Response(JSON.stringify({ error: 'Error upserting payout' }), { status: 500 })
      }
      break;

    case 'review.opened':
    case 'review.closed':
      const review = event.data.object as Stripe.Review
      
      // Update or create a record in a new 'stripe_reviews' table
      const { error: reviewUpsertError } = await supabase
        .from('stripe_reviews')
        .upsert({
          stripe_review_id: review.id,
          stripe_account_id: connectedAccountId,
          reason: review.reason,
          status: review.closed ? 'closed' : 'open',
          opened_at: new Date(review.created * 1000).toISOString(),
          closed_at: review.closed ? new Date(review.closed * 1000).toISOString() : null,
        })

      if (reviewUpsertError) {
        console.error('Error upserting review:', reviewUpsertError)
        return new Response(JSON.stringify({ error: 'Error upserting review' }), { status: 500 })
      }
      break;

    case 'transfer.created':
      const transfer = event.data.object as Stripe.Transfer;
      const transferTransactionId = transfer.metadata.transaction_id;

      if (!transferTransactionId) {
        return new Response(JSON.stringify({ error: 'No transaction ID found in transfer metadata' }), { status: 400 });
      }

      // Update the transaction with the transfer information
      const { error: transferUpdateError } = await supabase
        .from('transactions')
        .update({ 
          stripe_transfer_id: transfer.id,
          transfer_amount: transfer.amount / 100 // Convert cents to dollars
        })
        .eq('id', transferTransactionId);

      if (transferUpdateError) {
        console.error('Error updating transaction with transfer information:', transferUpdateError);
        return new Response(JSON.stringify({ error: 'Error updating transaction with transfer information' }), { status: 500 });
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
