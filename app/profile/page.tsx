import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe';
import StripeAccountInfo from '../account/stripe-account-info';
import dynamic from 'next/dynamic';
import { syncStripeData } from '@/utils/stripe-sync';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const AccountManagementUI = dynamic(() => import('@/components/AccountManagementUI'), { ssr: false });

export default async function ProfilePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Sync Stripe data
  try {
    await syncStripeData(user.id);
  } catch (error) {
    console.error('Failed to sync Stripe data:', error);
  }

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code === 'PGRST116') {
    // Profile doesn't exist, let's create one
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        first_name: '',
        last_name: '',
        is_onboarded: false,
      })
      .single()

    if (createError) {
      console.error('Error creating profile:', createError)
      return <div>Error creating profile</div>
    }

    profile = newProfile
  } else if (profileError) {
    console.error('Error fetching profile:', profileError)
    return <div>Error loading profile data</div>
  }

  let { data: stripeAccount, error: stripeError } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (stripeError && stripeError.code === 'PGRST116') {
    // No Stripe account found in the database, let's check with Stripe
    try {
      const stripeAccountId = user.user_metadata?.stripe_account_id;
      if (stripeAccountId) {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (account) {
          // We found a Stripe account, let's add it to our database
          const { data, error } = await supabase
            .from('stripe_accounts')
            .insert({
              user_id: user.id,
              stripe_account_id: account.id,
              stripe_onboarding_completed: account.details_submitted,
              stripe_account_created_at: account.created 
                ? new Date(account.created * 1000).toISOString()
                : new Date().toISOString(),
            })
            .single();

          if (error) {
            console.error('Error saving Stripe account to database:', error);
          } else {
            stripeAccount = data;
            stripeError = null;
          }
        }
      }
    } catch (error) {
      console.error('Error retrieving Stripe account:', error);
    }
  } else if (stripeError) {
    console.error('Error fetching Stripe account:', stripeError);
  }

  console.log('Profile:', profile);
  console.log('Stripe Account:', stripeAccount);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Profile</h1>
      {profile ? (
        <div>
          <p><strong>First Name:</strong> {profile.first_name || 'Not set'}</p>
          <p><strong>Last Name:</strong> {profile.last_name || 'Not set'}</p>
          <p><strong>Onboarded:</strong> {profile.is_onboarded ? 'Yes' : 'No'}</p>
          <p><strong>Created At:</strong> {new Date(profile.created_at).toLocaleString()}</p>
          <p><strong>Last Updated:</strong> {new Date(profile.updated_at).toLocaleString()}</p>
        </div>
      ) : (
        <p>No profile data found.</p>
      )}

      <div className="mt-8">
        <StripeAccountInfo account={stripeAccount || null} profile={profile || null} accountEmail={user.email || null} error={stripeError?.message} />
      </div>

      {stripeAccount && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Stripe Connect Account Management</h2>
          <AccountManagementUI />
        </div>
      )}
    </div>
  )
}
