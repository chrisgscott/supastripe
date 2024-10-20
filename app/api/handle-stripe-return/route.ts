import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(request: Request) {
  const { paymentIntentId } = await request.json();

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      cookies().set('paymentStatus', 'succeeded', { httpOnly: true, maxAge: 60 });
      
      // Fetch plan details from your database
      const supabase = createClient();
      const { data: planDetails, error } = await supabase
        .from('payment_plans')
        .select('*, customers(*)')
        .eq('id', paymentIntent.metadata.payment_plan_id)
        .single();

      if (error) {
        throw new Error('Failed to fetch plan details');
      }

      return NextResponse.json({ 
        success: true,
        planDetails: {
          customerName: planDetails.customers.name,
          customerEmail: planDetails.customers.email,
          totalAmount: planDetails.total_amount,
          numberOfPayments: planDetails.number_of_payments,
          paymentInterval: planDetails.payment_interval,
          // Add other necessary details
        }
      });
    } else {
      return NextResponse.json({ success: false, error: 'Payment failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling Stripe return:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
