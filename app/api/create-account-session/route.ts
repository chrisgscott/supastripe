import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!stripeAccount) {
      return NextResponse.json({ error: 'No Stripe account found' }, { status: 404 });
    }

    const accountSession = await stripe.accountSessions.create({
      account: stripeAccount.stripe_account_id,
      components: {
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      },
    });

    return NextResponse.json({ clientSecret: accountSession.client_secret });
  } catch (error: any) {
    console.error('Error creating account session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
