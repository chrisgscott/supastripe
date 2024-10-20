// app/api/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

// Set the platform fee (our fee) to 2%
const platformFeePercentage = 0.02;

interface Transaction {
  id: string;
  status: string;
  amount: number;
  payment_plans: {
    user_id: string;
  };
  is_downpayment: boolean;
}

interface PaymentPlan {
  id: string;
  total_amount: number;
  customers: {
    id: string;
    stripe_customer_id: string;
  } | {
    id: string;
    stripe_customer_id: string;
  }[];
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const { paymentPlanId, isSetupIntent } = await request.json();
    const supabase = createClient();

    // Fetch the payment plan data
    const { data: paymentPlan, error: fetchError } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        customers (id, stripe_customer_id)
      `)
      .eq('id', paymentPlanId)
      .single() as { data: PaymentPlan | null, error: any };

    if (fetchError || !paymentPlan) {
      throw new Error('Error fetching payment plan');
    }

    const stripeCustomerId = Array.isArray(paymentPlan.customers)
      ? paymentPlan.customers[0]?.stripe_customer_id
      : paymentPlan.customers?.stripe_customer_id;

    if (!stripeCustomerId) {
      throw new Error('Stripe customer ID not found');
    }

    if (isSetupIntent) {
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
      });

      return NextResponse.json({ clientSecret: setupIntent.client_secret });
    } else {
      // Existing PaymentIntent creation logic
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentPlan.total_amount,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          payment_plan_id: paymentPlan.id,
        },
      });

      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    }
  } catch (error) {
    console.error('Error creating intent:', error);
    return NextResponse.json({ error: 'Error creating intent' }, { status: 500 });
  }
}
