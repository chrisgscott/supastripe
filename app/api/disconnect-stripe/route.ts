import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function POST() {
  console.log('POST /api/disconnect-stripe - Starting...');
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('POST /api/disconnect-stripe - No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('POST /api/disconnect-stripe - User found:', user.id);

    // Get Stripe account
    const { data: stripeAccount, error: fetchError } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError) {
      console.error('POST /api/disconnect-stripe - Error fetching Stripe account:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch Stripe account' }, { status: 500 });
    }

    console.log('POST /api/disconnect-stripe - Stripe account found:', stripeAccount);

    if (stripeAccount?.stripe_account_id) {
      try {
        // Try to disconnect from Stripe
        console.log('POST /api/disconnect-stripe - Deleting Stripe account:', stripeAccount.stripe_account_id);
        await stripe.accounts.del(stripeAccount.stripe_account_id);
        console.log('POST /api/disconnect-stripe - Successfully deleted Stripe account');
      } catch (stripeError) {
        console.error('POST /api/disconnect-stripe - Stripe disconnection error:', stripeError);
        // Continue with local cleanup even if Stripe call fails
      }

      // Remove from our database
      console.log('POST /api/disconnect-stripe - Removing from database...');
      const { error: deleteError } = await supabase
        .from('stripe_accounts')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('POST /api/disconnect-stripe - Database deletion error:', deleteError);
        throw deleteError;
      }
      console.log('POST /api/disconnect-stripe - Successfully removed from database');
    } else {
      console.log('POST /api/disconnect-stripe - No Stripe account found to disconnect');
    }

    console.log('POST /api/disconnect-stripe - Successfully completed');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/disconnect-stripe - Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}