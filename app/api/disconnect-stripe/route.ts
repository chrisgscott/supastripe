import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/utils';

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Begin transaction
    await supabase.rpc('begin_transaction');

    try {
      // Get their Stripe account
      const { data: stripeAccount } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .single();

      if (stripeAccount?.stripe_account_id) {
        // Delete the Stripe connected account
        await stripe.accounts.del(stripeAccount.stripe_account_id);
      }

      // Clear Stripe-related fields from profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: null,
          business_url: null,
          support_phone: null,
          support_email: null,
          stripe_account_status: null,
          stripe_account_type: null,
          is_onboarded: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Delete the stripe_accounts record
      const { error: stripeAccountError } = await supabase
        .from('stripe_accounts')
        .delete()
        .eq('user_id', user.id);

      if (stripeAccountError) throw stripeAccountError;

      // Commit transaction
      await supabase.rpc('commit_transaction');

      return NextResponse.json({ success: true });

    } catch (innerError) {
      // Rollback on any error
      await supabase.rpc('rollback_transaction');
      throw innerError;
    }

  } catch (error: any) {
    console.error('Error disconnecting Stripe account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect Stripe account' },
      { status: 500 }
    );
  }
}