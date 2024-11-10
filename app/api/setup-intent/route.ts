import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { planId, stripeCustomerId } = await request.json();

    // If stripeCustomerId is provided, create setup intent directly
    if (stripeCustomerId) {
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });
      return NextResponse.json({ clientSecret: setupIntent.client_secret });
    }

    // Otherwise, handle plan-based setup intent creation
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: plan } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          stripe_customer_id
        )
      `)
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (!plan?.customers?.stripe_customer_id) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: plan.customers.stripe_customer_id,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}