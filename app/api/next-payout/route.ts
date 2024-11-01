import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import { format } from 'date-fns';
import { Database } from '@/types/supabase';
import { Money, formatCurrency } from '@/utils/currencyUtils';

type PayoutStatusType = Database['public']['Enums']['payout_status_type'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First check our database for pending payouts
    const { data: pendingPayout } = await supabase
      .from('payouts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('arrival_date', { ascending: true })
      .limit(1)
      .single();

    if (pendingPayout) {
      return NextResponse.json({
        amount: formatCurrency(Money.fromCents(pendingPayout.amount)),
        date: format(new Date(pendingPayout.arrival_date), 'MMM d, yyyy')
      });
    }

    // If no pending payout in our database, check Stripe
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!stripeAccount) {
      return NextResponse.json({ error: 'Stripe account not found' }, { status: 404 });
    }

    const payouts = await stripe.payouts.list(
      {
        limit: 1,
        arrival_date: {
          gte: Math.floor(Date.now() / 1000)
        },
      },
      {
        stripeAccount: stripeAccount.stripe_account_id,
      }
    );

    const nextPayout = payouts.data[0];

    if (!nextPayout) {
      return NextResponse.json({ 
        amount: 'None scheduled',
        date: null
      });
    }

    // Store the payout in our database
    await supabase.from('payouts').insert({
      user_id: user.id,
      amount: nextPayout.amount,
      currency: nextPayout.currency,
      arrival_date: new Date(nextPayout.arrival_date * 1000).toISOString(),
      status: 'pending' as PayoutStatusType,
      stripe_payout_id: nextPayout.id,
      stripe_account_id: stripeAccount.stripe_account_id
    });

    return NextResponse.json({
      amount: formatCurrency(Money.fromCents(nextPayout.amount)),
      date: format(new Date(nextPayout.arrival_date * 1000), 'MMM d, yyyy')
    });
  } catch (error) {
    console.error('Error fetching next payout:', error);
    return NextResponse.json({ error: 'Failed to fetch next payout' }, { status: 500 });
  }
}
