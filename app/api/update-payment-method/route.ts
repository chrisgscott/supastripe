import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();
  console.log('update-payment-method: Starting payment method update process');

  try {
    const { paymentPlanId } = await request.json();
    console.log('update-payment-method: Received request for plan:', paymentPlanId);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      console.log('update-payment-method: Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create new SetupIntent
    console.log('update-payment-method: Creating new setup intent for plan:', paymentPlanId);
    const { data: paymentPlan, error: planError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          stripe_customer_id
        )
      `)
      .eq('id', paymentPlanId)
      .eq('user_id', user.id)
      .single();

    if (planError || !paymentPlan) {
      console.error('update-payment-method: Error fetching payment plan:', planError);
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: paymentPlan.customers.stripe_customer_id,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
    console.log('update-payment-method: Created new setup intent:', setupIntent.id);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret
    });
  } catch (error) {
    console.error('update-payment-method: Error:', error);
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
  }
}