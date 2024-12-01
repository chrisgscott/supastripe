import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/utils'
import Stripe from 'stripe'

interface StripeAccountResponse {
  isConnected: boolean
  accountId: string | null
  isFullyOnboarded: boolean
  detailsSubmitted: boolean
  requirements: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
    currentDeadline: number | null
    disabledReason: string | null
    errors: Array<{
      code: string
      reason: string
      requirement: string
    }>
  }
  capabilities: Stripe.Account.Capabilities
  payoutsEnabled: boolean
  chargesEnabled: boolean
  businessProfile: {
    name: string | null
    url: string | null
    support_email: string | null
    support_phone: string | null
    product_description: string | null
  }
  settings: {
    branding: {
      icon: string | null
      logo: string | null
      primary_color: string | null
      secondary_color: string | null
    }
    payments: {
      statement_descriptor: string | null
      statement_descriptor_kana: string | null
      statement_descriptor_kanji: string | null
    }
  }
  tosAcceptance: {
    date: number | null
  }
  type: string
  created: number | null
}

export async function GET() {
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
      const emptyResponse: StripeAccountResponse = {
        isConnected: false,
        accountId: null,
        isFullyOnboarded: false,
        detailsSubmitted: false,
        requirements: {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
          currentDeadline: null,
          disabledReason: null,
          errors: []
        },
        capabilities: {},
        payoutsEnabled: false,
        chargesEnabled: false,
        businessProfile: {
          name: null,
          url: null,
          support_email: null,
          support_phone: null,
          product_description: null
        },
        settings: {
          branding: {
            icon: null,
            logo: null,
            primary_color: null,
            secondary_color: null
          },
          payments: {
            statement_descriptor: null,
            statement_descriptor_kana: null,
            statement_descriptor_kanji: null
          }
        },
        tosAcceptance: {
          date: null
        },
        type: 'standard',
        created: null
      }
      return NextResponse.json(emptyResponse)
    }

    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id)

    const status: StripeAccountResponse = {
      isConnected: account.details_submitted || false,
      accountId: account.id,
      isFullyOnboarded: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
      detailsSubmitted: account.details_submitted || false,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        currentDeadline: account.requirements?.current_deadline || null,
        disabledReason: account.requirements?.disabled_reason || null,
        errors: account.requirements?.errors || []
      },
      capabilities: account.capabilities || {},
      payoutsEnabled: account.payouts_enabled || false,
      chargesEnabled: account.charges_enabled || false,
      businessProfile: {
        name: account.business_profile?.name || null,
        url: account.business_profile?.url || null,
        support_email: account.business_profile?.support_email || null,
        support_phone: account.business_profile?.support_phone || null,
        product_description: account.business_profile?.product_description || null
      },
      settings: {
        branding: {
          icon: typeof account.settings?.branding?.icon === 'string' ? account.settings.branding.icon : null,
          logo: typeof account.settings?.branding?.logo === 'string' ? account.settings.branding.logo : null,
          primary_color: account.settings?.branding?.primary_color || null,
          secondary_color: account.settings?.branding?.secondary_color || null
        },
        payments: {
          statement_descriptor: account.settings?.payments?.statement_descriptor || null,
          statement_descriptor_kana: account.settings?.payments?.statement_descriptor_kana || null,
          statement_descriptor_kanji: account.settings?.payments?.statement_descriptor_kanji || null
        }
      },
      tosAcceptance: {
        date: account.tos_acceptance?.date || null
      },
      type: account.type || 'standard',
      created: account.created || null
    }

    console.log('Stripe Account Status:', JSON.stringify(status, null, 2))
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error in stripe-status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}