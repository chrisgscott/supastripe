// @ts-nocheck

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// This matches the status column in the payouts table
type PayoutStatusType = string

interface StripePayoutEvent {
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      arrival_date: number;
      status: 'paid' | 'failed' | 'canceled' | 'pending';
    }
  };
  account: string;
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()
  
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_PAYOUT_WEBHOOK_SECRET')!
    ) as StripePayoutEvent

    if (['payout.created', 'payout.failed', 'payout.canceled', 'payout.paid'].includes(event.type)) {
      const payout = event.data.object
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: account } = await supabase
        .from('stripe_accounts')
        .select('user_id')
        .eq('stripe_account_id', event.account)
        .single()

      if (account) {
        await supabase.from('payouts').upsert({
          amount: payout.amount,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          currency: payout.currency,
          status: payout.status,
          stripe_account_id: event.account,
          stripe_payout_id: payout.id,
          user_id: account.user_id,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'stripe_payout_id'
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const error = err as Error
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})