import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get('stripe-signature')!;
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const supabase = createClient();

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      
      // Update stripe_accounts table
      const { error: stripeError } = await supabase
        .from('stripe_accounts')
        .update({
          stripe_onboarding_completed: account.details_submitted,
          stripe_account_details_url: `https://dashboard.stripe.com/${account.id}`,
        })
        .eq('stripe_account_id', account.id);

      if (stripeError) {
        console.error('Error updating stripe_accounts:', stripeError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // If onboarding is completed, update profiles table with Stripe data
      if (account.details_submitted) {
        const { data: stripeAccount } = await supabase
          .from('stripe_accounts')
          .select('user_id')
          .eq('stripe_account_id', account.id)
          .single();

        if (stripeAccount) {
          const profileUpdate: any = {
            business_name: account.business_profile?.name,
            business_url: account.business_profile?.url,
            support_email: account.business_profile?.support_email,
            support_phone: account.business_profile?.support_phone,
          };

          // Add address if available
          if (account.business_profile?.support_address) {
            const address = account.business_profile.support_address;
            profileUpdate.address_line1 = address.line1;
            profileUpdate.address_line2 = address.line2;
            profileUpdate.address_city = address.city;
            profileUpdate.address_state = address.state;
            profileUpdate.address_postal_code = address.postal_code;
            profileUpdate.address_country = address.country;
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', stripeAccount.user_id);

          if (profileError) {
            console.error('Error updating profiles:', profileError);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}