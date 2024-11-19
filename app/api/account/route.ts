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
      country: 'US', // or the appropriate country code
      email: user.email, // Add the user's email to the Stripe account
    });

    console.log('POST /api/account - Stripe account created:', account)

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

    // Update the profiles table with business profile information only if values exist
    const profileUpdateData: Record<string, any> = {};

    // Only include fields that have actual values from Stripe
    if (fullAccount.business_profile?.name) {
      profileUpdateData.business_name = fullAccount.business_profile.name;
    }
    if (fullAccount.business_profile?.url) {
      profileUpdateData.business_url = fullAccount.business_profile.url;
    }
    if (fullAccount.business_profile?.support_phone) {
      profileUpdateData.support_phone = fullAccount.business_profile.support_phone;
    }
    if (fullAccount.business_profile?.support_email) {
      profileUpdateData.support_email = fullAccount.business_profile.support_email;
    }

    // Only perform the update if we have data to update
    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('Error updating profile with business information:', profileUpdateError);
      } else {
        console.log('Profile updated with Stripe data:', profileUpdateData);
      }
    }

    console.log('POST /api/account - Success')
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
