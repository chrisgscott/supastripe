import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: stripeAccount, error } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching Stripe account:', error)
      return NextResponse.json({ error: 'Failed to fetch Stripe account' }, { status: 500 })
    }

    console.log('Stripe Account Status:', {
      accountExists: !!stripeAccount,
      onboardingCompleted: stripeAccount?.stripe_onboarding_completed,
      accountDetails: stripeAccount
    })

    return NextResponse.json({ stripeAccount })
  } catch (error) {
    console.error('Error in stripe-status route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}