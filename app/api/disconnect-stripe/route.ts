import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Stripe account
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (stripeAccount) {
      try {
        // Try to disconnect from Stripe, but don't fail if it errors
        await stripe.accounts.del(stripeAccount.stripe_account_id);
      } catch (stripeError) {
        console.error('Stripe disconnection error:', stripeError);
        // Continue with local cleanup even if Stripe call fails
      }

      // Remove from our database
      const { error: deleteError } = await supabase
        .from('stripe_accounts')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in disconnect-stripe:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}