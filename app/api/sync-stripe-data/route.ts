import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const { userId } = await request.json();
  const supabase = createClient();

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Fetch the Stripe account ID
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

    if (!stripeAccount) {
      return NextResponse.json({ error: 'No Stripe account found' }, { status: 404 });
    }

    // Fetch the latest data from Stripe
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

    // Update the profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        business_name: account.business_profile?.name || null,
        business_url: account.business_profile?.url || null,
        business_phone: account.business_profile?.support_phone || null,
        business_email: account.business_profile?.support_email || account.email || null,
        is_onboarded: account.details_submitted,
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Update the stripe_accounts table
    const { error: stripeUpdateError } = await supabase
      .from('stripe_accounts')
      .update({
        stripe_onboarding_completed: account.details_submitted,
        stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
      })
      .eq('user_id', user.id);

    if (stripeUpdateError) {
      throw stripeUpdateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error syncing Stripe data:', error);
    return NextResponse.json({ error: 'Error syncing Stripe data' }, { status: 500 });
  }
}
