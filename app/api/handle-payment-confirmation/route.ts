import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/types/supabase";
import crypto from "crypto";
import { Money } from "@/utils/currencyUtils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('payment_intent');

  if (!paymentIntentId) {
    return NextResponse.json({
      success: false,
      error: 'Payment intent ID is required'
    }, { status: 400 });
  }

  try {
    // First, get the payment plan ID from the processing logs
    const { data: processingLog, error: logError } = await supabase
      .from('payment_processing_logs')
      .select('payment_plan_id, transaction_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logError) {
      console.error('Error fetching processing log:', logError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch payment record'
      }, { status: 500 });
    }

    // Fetch the Stripe payment intent regardless of processing log
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method']
    });

    const paymentPlanId = processingLog?.payment_plan_id || stripePaymentIntent.metadata?.payment_plan_id;

    if (!paymentPlanId) {
      return NextResponse.json({
        success: false,
        error: 'Payment plan ID not found'
      }, { status: 404 });
    }

    // Fetch the payment plan with related data
    const { data: paymentPlan, error: planError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (name, email),
        transactions (
          amount,
          due_date,
          is_downpayment,
          status
        )
      `)
      .eq('id', paymentPlanId)
      .single();

    if (planError) {
      console.error('Error fetching payment plan:', planError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch payment plan details'
      }, { status: 500 });
    }

    // Fetch business details
    const { data: businessInfo, error: businessError } = await supabase
      .from('profiles')
      .select('business_name, support_email, support_phone')
      .single();

    if (businessError) {
      console.error('Error fetching business info:', businessError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch business details'
      }, { status: 500 });
    }

    const paymentMethod = stripePaymentIntent.payment_method as Stripe.PaymentMethod;

    // Format the response data
    const formattedPlanDetails = {
      customerName: paymentPlan.customers.name,
      customerEmail: paymentPlan.customers.email,
      totalAmount: paymentPlan.total_amount,
      numberOfPayments: paymentPlan.number_of_payments,
      paymentInterval: paymentPlan.payment_interval,
      paymentPlanId: paymentPlan.id,
      paymentSchedule: paymentPlan.transactions.map((t: Tables<'transactions'>) => ({
        amount: t.amount,
        date: t.due_date,
        is_downpayment: t.is_downpayment,
        status: t.status || 'pending'
      })),
      businessDetails: {
        name: businessInfo.business_name,
        supportPhone: businessInfo.support_phone,
        supportEmail: businessInfo.support_email
      },
      paymentMethod: paymentMethod && {
        brand: paymentMethod.type === 'card' ? paymentMethod.card?.brand : undefined,
        last4: paymentMethod.type === 'card' ? paymentMethod.card?.last4 : undefined
      }
    };

    // If we don't have a processing log yet, create one
    if (!processingLog) {
      const idempotencyKey = crypto.randomUUID();
      const { error: createLogError } = await supabase
        .from('payment_processing_logs')
        .insert({
          payment_plan_id: paymentPlanId,
          stripe_payment_intent_id: paymentIntentId,
          status: stripePaymentIntent.status,
          idempotency_key: idempotencyKey
        });

      if (createLogError) {
        console.error('Error creating processing log:', createLogError);
        // Don't return error here, as we still want to return the plan details
      }
    }

    // After verifying the payment intent and before creating the processing log
    if (stripePaymentIntent.status === 'succeeded') {
      const idempotencyKey = crypto.randomUUID();
      
      // Call the database function to complete plan creation
      const { error: completionError } = await supabase
        .rpc('complete_payment_plan_creation', {
          p_payment_plan_id: paymentPlanId,
          p_stripe_payment_intent_id: paymentIntentId,
          p_idempotency_key: idempotencyKey
        });

      if (completionError) {
        console.error('Error completing payment plan creation:', completionError);
        return NextResponse.json({
          success: false,
          error: 'Failed to complete payment plan creation'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      planDetails: formattedPlanDetails,
      status: {
        customerCreated: true,
        paymentPlanCreated: true,
        transactionsCreated: true,
        paymentIntentCreated: true
      }
    });

  } catch (error) {
    console.error('Error in handle-payment-confirmation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}