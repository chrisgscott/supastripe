import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/utils'

export async function POST() {
  console.log('POST /api/profile/sync - Starting...')
  try {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's stripe account id from Supabase
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!stripeAccount?.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account found' }, { status: 404 })
    }

    // Fetch the account details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id)
    console.log('POST /api/profile/sync - Stripe account retrieved:', {
      id: account.id,
      business_profile: account.business_profile,
      details_submitted: account.details_submitted
    })

    // Update the profile with Stripe information
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        stripe_account_id: account.id,
        business_name: account.business_profile?.name,
        business_url: account.business_profile?.url,
        support_email: account.business_profile?.support_email,
        support_phone: account.business_profile?.support_phone,
        business_description: account.business_profile?.product_description,
        is_onboarded: account.details_submitted,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    console.log('POST /api/profile/sync - Profile updated successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in profile sync:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
