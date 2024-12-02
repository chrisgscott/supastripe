import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Brevo
const brevoApiKey = process.env.BREVO_API_KEY!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret!);
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Webhook Error', { status: 400 });
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;

        // Log the entire account object and specific fields we're interested in
        console.log('Stripe Account Details:', JSON.stringify({
          id: account.id,
          business_type: account.business_type,
          individual: account.individual,
          company: account.company,
          business_profile: account.business_profile
        }, null, 2));

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
            // Get the account representative's details from Stripe
            const representative = account.representative;
            
            const profileUpdate: any = {
              business_name: account.business_profile?.name,
              business_url: account.business_profile?.url,
              support_email: account.business_profile?.support_email,
              support_phone: account.business_profile?.support_phone,
              stripe_account_id: account.id,
              updated_at: new Date().toISOString(),
              // Add first and last name from account representative
              first_name: representative?.first_name,
              last_name: representative?.last_name,
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
              .upsert({
                id: stripeAccount.user_id,
                ...profileUpdate
              })
              .eq('id', stripeAccount.user_id);

            if (profileError) {
              console.error('Error updating profiles:', profileError);
            }
          }
        }

        // Find the user associated with this Stripe account
        const { data: stripeAccount, error: findError } = await supabase
          .from('stripe_accounts')
          .select('user_id')
          .eq('stripe_account_id', account.id)
          .single();

        if (findError || !stripeAccount) {
          console.error('Error finding user for Stripe account:', findError);
          return new Response('User not found', { status: 404 });
        }

        // Get user's email
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('id', stripeAccount.user_id)
          .single();

        if (userError || !user?.email) {
          console.error('Error finding user email:', userError);
          return new Response('User email not found', { status: 404 });
        }

        // If the account was just verified
        if (account.charges_enabled && account.details_submitted) {
          // TODO: Implement email notification when account is verified
          // Should use Brevo to send a confirmation email with next steps
          // Email should include:
          // - Confirmation of verification
          // - Link to create first payment plan
          // - Link to Stripe dashboard
          // - Any helpful resources or documentation
          console.log('Account verified for user:', user.email);
          // 
          // const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          //   method: 'POST',
          //   headers: {
          //     'accept': 'application/json',
          //     'api-key': brevoApiKey,
          //     'content-type': 'application/json',
          //   },
          //   body: JSON.stringify({
          //     sender: {
          //       name: 'SupaStripe',
          //       email: 'notifications@example.com'
          //     },
          //     to: [{
          //       email: user.email
          //     }],
          //     subject: 'Your Stripe Account is Verified! 🎉',
          //     htmlContent: `
          //       <h1>Great news!</h1>
          //       <p>Your Stripe account has been verified and is ready to accept payments.</p>
          //       <p>Next steps:</p>
          //       <ul>
          //         <li>Set up your first payment plan</li>
          //         <li>Customize your business profile</li>
          //         <li>Review the Stripe dashboard</li>
          //       </ul>
          //       <p>
          //         <a href="${process.env.NEXT_PUBLIC_BASE_URL}/onboarding">
          //           Continue to your dashboard →
          //         </a>
          //       </p>
          //     `
          //   })
          // });

          // if (!response.ok) {
          //   console.error('Error sending email:', await response.text());
          // }
        }
        break;
      }
      // ... other event handlers ...
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Webhook Error', { status: 400 });
  }
}