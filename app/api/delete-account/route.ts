import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch the user's Stripe account ID
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (stripeAccount && stripeAccount.stripe_account_id) {
      // Remove the Stripe Connect account from our platform
      await stripe.accounts.del(stripeAccount.stripe_account_id);
    }

    // Delete user's profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // Delete user's stripe account record
    await supabase
      .from('stripe_accounts')
      .delete()
      .eq('user_id', user.id);

    // Delete the user's auth account
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) throw deleteUserError;

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
