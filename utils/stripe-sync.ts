import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/utils';

export async function syncStripeData(userId: string) {
  const supabase = createClient();

  // Fetch the Stripe account ID
  const { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .single();

  if (!stripeAccount) {
    throw new Error('No Stripe account found');
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
      business_email: account.business_profile?.support_email || null,
      is_onboarded: account.details_submitted,
    })
    .eq('id', userId);

  if (updateError) {
    throw updateError;
  }

  // Update the stripe_accounts table
  const { error: stripeUpdateError } = await supabase
    .from('stripe_accounts')
    .update({
      stripe_onboarding_completed: account.details_submitted,
    })
    .eq('user_id', userId);

  if (stripeUpdateError) {
    throw stripeUpdateError;
  }
}