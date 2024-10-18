// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@12.18.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
})

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  )

  const payload = await req.text()
  console.log('Received webhook payload:', payload)

  const sig = req.headers.get('stripe-signature') as string
  const connectedAccountId = req.headers.get('stripe-account') as string

  let event

  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') as string,
      undefined,
      cryptoProvider
    )
    console.log(`Received valid ${event.type} event:`, JSON.stringify(event, null, 2))
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, supabase)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, supabase)
        break
      case 'account.updated':
        await handleAccountUpdated(event.data.object, supabase)
        break
      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed':
        await handlePayout(event.data.object, supabase, connectedAccountId)
        break
      case 'review.opened':
      case 'review.closed':
        await handleReview(event.data.object, supabase, connectedAccountId)
        break
      case 'transfer.created':
        await handleTransfer(event.data.object, supabase)
        break
      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error)
    return new Response(JSON.stringify({ error: `Error processing ${event.type}` }), { status: 500 })
  }
})

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const transactionId = paymentIntent.metadata.transaction_id

  if (!transactionId) {
    throw new Error('No transaction ID found in metadata')
  }

  console.log(`Processing successful payment for transaction ${transactionId}`)

  // Update transaction status
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ 
      status: 'paid',
      paid_at: new Date().toISOString()
    })
    .eq('id', transactionId)

  if (updateError) {
    console.error(`Error updating transaction ${transactionId}:`, updateError)
    throw updateError
  }

  // Fetch the transaction and related payment plan
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('*, payment_plans(*)')
    .eq('id', transactionId)
    .single()

  if (fetchError) {
    console.error(`Error fetching transaction ${transactionId}:`, fetchError)
    throw fetchError
  }

  // Check if this is the first paid transaction for the payment plan
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact' })
    .eq('payment_plan_id', transaction.payment_plan_id)
    .eq('status', 'paid')

  if (countError) {
    console.error(`Error counting paid transactions for payment plan ${transaction.payment_plan_id}:`, countError)
    throw countError
  }

  // If this is the first paid transaction, update the payment plan status to 'active'
  if (count === 1) {
    const { error: planUpdateError } = await supabase
      .from('payment_plans')
      .update({ status: 'active' })
      .eq('id', transaction.payment_plan_id)

    if (planUpdateError) {
      console.error(`Error updating payment plan ${transaction.payment_plan_id}:`, planUpdateError)
      throw planUpdateError
    }
  }

  console.log(`Successfully processed payment for transaction ${transactionId}`)
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  const transactionId = paymentIntent.metadata.transaction_id

  if (!transactionId) {
    throw new Error('No transaction ID found in metadata')
  }

  console.log(`Processing failed payment for transaction ${transactionId}`)

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
    .select('payment_plan_id')
    .eq('id', transactionId)
    .single()

  if (fetchError) {
    console.error(`Error fetching transaction ${transactionId}:`, fetchError)
    throw fetchError
  }

  const { error: planUpdateError } = await supabase
    .from('payment_plans')
    .update({ status: 'failed' })
    .eq('id', transaction.payment_plan_id)

  if (planUpdateError) {
    console.error(`Error updating payment plan ${transaction.payment_plan_id}:`, planUpdateError)
    throw planUpdateError
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
