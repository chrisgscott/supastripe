import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Initialize Stripe
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('Missing Stripe secret key');
    return new NextResponse('Server configuration error', { status: 500 });
  }
  const stripe = new Stripe(stripeSecretKey);

  // Initialize Brevo
  const brevoApiKey = process.env.BREVO_API_KEY!;

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing Stripe webhook secret');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;

        console.log('Processing account.updated webhook for account:', account.id);

        // Update stripe_accounts table
        const { data: stripeAccount, error: stripeError } = await supabase
          .from('stripe_accounts')
          .update({
            stripe_onboarding_completed: account.details_submitted,
            stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
          })
          .eq('stripe_account_id', account.id)
          .select('user_id')
          .single();

        if (stripeError) {
          console.error('Error updating stripe_accounts:', stripeError);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!stripeAccount?.user_id) {
          console.error('No user_id found for stripe account:', account.id);
          return NextResponse.json({ error: 'No user found' }, { status: 404 });
        }

        // Map Stripe account data to our profile schema
        const profileUpdate = {
          updated_at: new Date().toISOString(),
          stripe_account_id: account.id,
          
          // Business profile information
          business_name: account.business_profile?.name || null,
          business_url: account.business_profile?.url || null,
          support_email: account.business_profile?.support_email || null,
          support_phone: account.business_profile?.support_phone || null,
          business_type: account.business_profile?.mcc || null, // Merchant Category Code
          business_description: account.settings?.dashboard?.display_name || null,

          // Address information from business profile
          address_line1: account.business_profile?.support_address?.line1 || null,
          address_line2: account.business_profile?.support_address?.line2 || null,
          address_city: account.business_profile?.support_address?.city || null,
          address_state: account.business_profile?.support_address?.state || null,
          address_postal_code: account.business_profile?.support_address?.postal_code || null,
          address_country: account.business_profile?.support_address?.country || null,

          // Split the business name into first/last name if no individual details
          first_name: account.business_profile?.name ? 
            account.business_profile.name.split(' ')[0] : null,
          last_name: account.business_profile?.name ? 
            account.business_profile.name.split(' ').slice(1).join(' ') : null,

          // Mark as onboarded if charges are enabled
          is_onboarded: account.charges_enabled || false
        };

        console.log('Updating profile with data:', profileUpdate);

        // Update the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', stripeAccount.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }
      // ... other event handlers ...
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Webhook Error', { status: 400 });
  }
}