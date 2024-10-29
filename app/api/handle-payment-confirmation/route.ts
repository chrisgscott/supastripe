import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";
import { Money } from "@/utils/currencyUtils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  console.log('handle-payment-confirmation POST: Started');
  const supabase = createClient();
  
  try {
    const { data: { paymentIntent } } = await request.json();
    console.log('handle-payment-confirmation POST: Received payment intent:', paymentIntent);

    if (paymentIntent.status === "succeeded") {
      const { data: plan, error } = await supabase
        .from("payment_plans")
        .select("*, customers(*)")
        .eq("id", paymentIntent.metadata.payment_plan_id)
        .eq("plan_creation_status", "pending")
        .single();

      if (error) {
        console.error("Error fetching plan details:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch plan details", details: error },
          { status: 500 }
        );
      }

      const idempotencyKey = crypto.randomUUID();
      const { error: completionError } = await supabase
        .rpc('complete_payment_plan_creation', {
          p_payment_plan_id: plan.id,
          p_stripe_payment_intent_id: paymentIntent.id,
          p_idempotency_key: idempotencyKey
        });

      if (completionError) {
        console.error("Error completing payment plan creation:", completionError);
        return NextResponse.json(
          { success: false, error: "Failed to complete payment plan creation" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Payment not succeeded" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("handle-payment-confirmation: Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get("payment_intent");
  
  console.log('GET handler - Payment Intent ID:', paymentIntentId);
  
  if (!paymentIntentId) {
    return NextResponse.json(
      { success: false, error: "No payment intent ID provided" },
      { status: 400 }
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('Retrieved payment intent:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });
    
    const supabase = createClient();

    if (paymentIntent.status === "succeeded") {
      if (!paymentIntent.metadata.payment_plan_id) {
        console.error('No payment_plan_id in metadata:', paymentIntent.metadata);
        return NextResponse.json(
          { success: false, error: "No payment plan ID in metadata" },
          { status: 400 }
        );
      }

      const idempotencyKey = crypto.randomUUID();
      console.log('Calling RPC with params:', {
        p_idempotency_key: idempotencyKey,
        p_payment_plan_id: paymentIntent.metadata.payment_plan_id,
        p_stripe_payment_intent_id: paymentIntent.id
      });

      console.log('Payment Intent Details:', {
        id: paymentIntent.id,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
        payment_plan_id: paymentIntent.metadata.payment_plan_id
      });

      console.log('RPC Function Call:', {
        function: 'complete_payment_plan_creation',
        parameters: {
          p_idempotency_key: idempotencyKey,
          p_payment_plan_id: paymentIntent.metadata.payment_plan_id,
          p_stripe_payment_intent_id: paymentIntent.id
        }
      });

      const { error: completionError } = await supabase
        .rpc('complete_payment_plan_creation', {
          p_payment_plan_id: paymentIntent.metadata.payment_plan_id,
          p_stripe_payment_intent_id: paymentIntent.id,
          p_idempotency_key: idempotencyKey
        });

      if (completionError) {
        console.error("Error completing payment plan creation:", {
          error: completionError,
          params: {
            p_idempotency_key: idempotencyKey,
            p_payment_plan_id: paymentIntent.metadata.payment_plan_id,
            p_stripe_payment_intent_id: paymentIntent.id
          }
        });
        return NextResponse.json(
          { success: false, error: "Failed to complete payment plan creation" },
          { status: 500 }
        );
      }

      const { data: plan, error } = await supabase
        .from("payment_plans")
        .select("*, customers(*)")
        .eq("id", paymentIntent.metadata.payment_plan_id)
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: "Failed to fetch plan details" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        planDetails: {
          paymentPlanId: plan.id,
          customerName: plan.customers.name,
          customerEmail: plan.customers.email,
          totalAmount: plan.total_amount,
          numberOfPayments: plan.number_of_payments,
          paymentInterval: plan.payment_interval,
        },
        status: {
          customerCreated: true,
          paymentPlanCreated: true,
          transactionsCreated: true,
          paymentProcessed: plan.plan_creation_status === 'completed'
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Payment not succeeded" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
