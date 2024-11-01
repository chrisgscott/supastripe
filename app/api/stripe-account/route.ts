import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET() {
  const supabase = createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.user_metadata?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Stripe account not connected' },
        { status: 404 }
      );
    }

    const account = await stripe.accounts.retrieve(user.user_metadata.stripe_account_id);
    
    return NextResponse.json({
      id: account.id,
      charges_enabled: account.charges_enabled,
      business_profile: account.business_profile,
      requirements: account.requirements?.currently_due || []
    });
  } catch (error) {
    console.error('Error fetching Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Stripe account details' },
      { status: 500 }
    );
  }
}
