import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();
    const supabase = createClient();

    // Create a Stripe customer
    const customer = await stripe.customers.create({
      name,
      email,
    });

    // Update the customer in the database with the Stripe customer ID
    const { error } = await supabase
      .from('customers')
      .update({ stripe_customer_id: customer.id })
      .eq('email', email);

    if (error) {
      throw new Error('Error updating customer in database');
    }

    return NextResponse.json({ stripeCustomerId: customer.id });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return NextResponse.json({ error: 'Error creating Stripe customer' }, { status: 500 });
  }
}