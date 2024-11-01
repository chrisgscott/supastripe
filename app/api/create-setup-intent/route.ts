import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { stripeCustomerId } = await request.json();
    
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret
    });

  } catch (error: any) {
    console.error("create-setup-intent: Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}