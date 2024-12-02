// / app/account/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  console.log('POST /api/account - Starting...')
  
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create a new connected account with the Stripe API
    const account = await stripe.accounts.create({
      type: 'standard',
      country: 'US',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
    });

    console.log('POST /api/account - Stripe account created:', account)

    // Save the account information to the stripe_accounts table
    const { error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: user.id,
        stripe_account_id: account.id,
        stripe_onboarding_completed: false,
        stripe_account_created_at: new Date().toISOString(),
        stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
      });

    if (stripeAccountError) {
      console.error('Error saving Stripe account to database:', stripeAccountError);
      return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 });
    }

    // Create or update the user's profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        stripe_account_id: account.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error creating/updating profile:', profileError);
      // Don't return error here as the Stripe account was created successfully
    }

    // Fetch the full account details from Stripe
    const fullAccount = await stripe.accounts.retrieve(account.id);

    // Return success with a tracking parameter
    return NextResponse.json({ 
      success: true,
      track: 'stripe_connected',
      accountId: account.id 
    });
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
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching Stripe account:', error);
    return NextResponse.json({ error: 'Error fetching Stripe account' }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
