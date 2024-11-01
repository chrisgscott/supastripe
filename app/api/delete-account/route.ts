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
    // Begin transaction
    await supabase.rpc('begin_transaction');

    try {
      const { data: stripeAccount } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .single();

      if (stripeAccount?.stripe_account_id) {
        await stripe.accounts.del(stripeAccount.stripe_account_id);
      }

      // Delete all related records in order of dependencies
      await supabase.from('email_logs').delete().eq('user_id', user.id);
      
      const { data: paymentPlans } = await supabase
        .from('payment_plans')
        .select('id')
        .eq('user_id', user.id);
        
      if (paymentPlans) {
        const planIds = paymentPlans.map(plan => plan.id);
        await supabase.from('transactions').delete().in('payment_plan_id', planIds);
        await supabase.from('payment_plans').delete().in('id', planIds);
      }

      await supabase.from('customers').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.from('stripe_accounts').delete().eq('user_id', user.id);

      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteUserError) throw deleteUserError;

      // If we got here, commit the transaction
      await supabase.rpc('commit_transaction');

      return NextResponse.json({ message: 'Account deleted successfully' });

    } catch (innerError) {
      // Rollback on any error
      await supabase.rpc('rollback_transaction');
      throw innerError;
    }

  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
