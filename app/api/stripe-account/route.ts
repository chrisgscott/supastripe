import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET() {
  const cookieStore = cookies();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'Cookie': cookieStore.toString(),
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const account = await stripe.accounts.retrieve(user.user_metadata.stripe_account_id);
    return NextResponse.json({
      id: account.id,
      business_type: account.business_type,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements,
      balance: await stripe.balance.retrieve({ stripeAccount: account.id }),
      default_currency: account.default_currency,
      country: account.country,
      business_profile: account.business_profile,
    });
  } catch (error) {
    console.error('Error fetching Stripe account:', error);
    return NextResponse.json({ error: 'Error fetching Stripe account' }, { status: 500 });
  }
}
