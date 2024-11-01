import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.user_metadata?.stripe_account_id) {
      return NextResponse.json(
        { error: 'No Stripe account connected' },
        { status: 404 }
      );
    }

    // Fetch the latest data from Stripe
    const account = await stripe.accounts.retrieve(user.user_metadata.stripe_account_id);

    // Update the profiles table with Stripe data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        business_name: account.business_profile?.name || null,
        business_url: account.business_profile?.url || null,
        support_phone: account.business_profile?.support_phone || null,
        support_email: account.business_profile?.support_email || account.email || null,
        stripe_account_status: account.charges_enabled ? 'active' : 'pending',
        stripe_account_type: account.type || 'standard',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      charges_enabled: account.charges_enabled,
      requirements: account.requirements?.currently_due || []
    });
  } catch (error) {
    console.error('Error syncing Stripe data:', error);
    return NextResponse.json(
      { error: 'Failed to sync Stripe account data' },
      { status: 500 }
    );
  }
}
