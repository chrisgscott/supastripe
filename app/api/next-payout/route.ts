import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import { format } from 'date-fns';

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

    console.log('Payouts data:', JSON.stringify(payouts, null, 2));

    const nextPayout = payouts.data[0];

    if (!nextPayout) {
      return NextResponse.json({ 
        amount: 'None scheduled',
        date: null
      });
    }

    let amount = nextPayout.amount && nextPayout.currency
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: nextPayout.currency,
        }).format(nextPayout.amount / 100)
      : null;

    let date = nextPayout.arrival_date
      ? format(new Date(nextPayout.arrival_date * 1000), 'MMM d, yyyy')
      : null;

    return NextResponse.json({
      amount,
      ...(date && { date }),
    });
  } catch (error) {
    console.error('Error fetching next payout:', error);
    return NextResponse.json({ error: 'Failed to fetch next payout' }, { status: 500 });
  }
}
