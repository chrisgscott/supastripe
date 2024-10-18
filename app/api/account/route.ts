// app/account/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create a new connected account with the Stripe API
    const account = await stripe.accounts.create({
      type: 'standard',
      country: 'US', // or the appropriate country code
      email: user.email, // Add the user's email to the Stripe account
    });

    console.log('Created Stripe account:', account);

    // Save the account information to the stripe_accounts table
    const { data: stripeAccountData, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: user.id,
        stripe_account_id: account.id,
        stripe_onboarding_completed: false,
        stripe_account_created_at: new Date().toISOString(),
        stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
      })
      .select()
      .single();

    if (stripeAccountError) {
      console.error('Error saving Stripe account to database:', stripeAccountError);
      return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 });
    }

    // Fetch the full account details from Stripe
    const fullAccount = await stripe.accounts.retrieve(account.id);

    console.log('Full Stripe account:', fullAccount);

    // Update the profiles table with business profile information
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        business_name: fullAccount.business_profile?.name || '',
        business_url: fullAccount.business_profile?.url || '',
        support_phone: fullAccount.business_profile?.support_phone || '',
        support_email: fullAccount.business_profile?.support_email || fullAccount.email || user.email || '',
        is_onboarded: false,
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      console.error('Error updating profile with business information:', profileUpdateError);
      // We don't return an error here as the Stripe account was successfully created
    } else {
      console.log('Profile updated successfully');
    }

    return NextResponse.json({ account: account.id });
  } catch (error: any) {
    console.error('An error occurred when creating or saving the Stripe account:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching Stripe account:', error);
    return NextResponse.json({ error: 'Error fetching Stripe account' }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
