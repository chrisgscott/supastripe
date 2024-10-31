import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { formatCurrency, Money } from '@/utils/currencyUtils';

interface PaymentScheduleItem {
  date: string;
  amount: number;
  is_downpayment: boolean;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  console.log('create-payment-intent-and-plan-id: POST request received');
  const supabase = createClient();
  let stripeCustomer: Stripe.Customer | undefined;
  let paymentIntent: Stripe.PaymentIntent | undefined;

  try {
    const paymentPlan = await request.json();
    const firstPayment = paymentPlan.paymentSchedule[0];

    // If this is the first payment (regardless of whether it was marked as downpayment)
    // treat it as a downpayment for processing purposes
    firstPayment.is_downpayment = true;

    console.log('create-payment-intent-and-plan-id: Received payment plan:', paymentPlan);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('create-payment-intent-and-plan-id: Authenticated user:', user.id);

    // Retrieve the connected account ID
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (stripeAccountError || !stripeAccount?.stripe_account_id) {
      console.error('create-payment-intent-and-plan-id: Stripe account not found:', stripeAccountError);
      throw new Error('Stripe account not connected for this user');
    }

    console.log('create-payment-intent-and-plan-id: Retrieved Stripe account:', stripeAccount.stripe_account_id);

    // Check if customer exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: paymentPlan.customerEmail,
      limit: 1
    });

    stripeCustomer = existingCustomers.data.length > 0
      ? existingCustomers.data[0]
      : await stripe.customers.create({
          name: paymentPlan.customerName,
          email: paymentPlan.customerEmail,
        });

    console.log('create-payment-intent-and-plan-id: Stripe customer:', stripeCustomer.id);

    // Generate a unique ID for the payment plan
    const paymentPlanId = crypto.randomUUID();
    console.log('create-payment-intent-and-plan-id: Generated payment plan ID:', paymentPlanId);

    // Convert payment schedule amounts to cents before sending to database
    const convertedPaymentSchedule = paymentPlan.paymentSchedule.map((payment: PaymentScheduleItem) => ({
      ...payment,
      amount: Money.fromDollars(payment.amount).toCents()
    }));

    const idempotencyKey = crypto.randomUUID();
    console.log('Creating payment plan with notes:', {
      hasNotes: !!paymentPlan.notes,
      notes: paymentPlan.notes
    });

    const { data: dbPlan, error: dbError } = await supabase
      .rpc('create_payment_plan_step1', {
        p_customer_name: paymentPlan.customerName,
        p_customer_email: paymentPlan.customerEmail,
        p_user_id: user.id,
        p_total_amount: Math.round(Money.fromDollars(paymentPlan.totalAmount).toCents()),
        p_number_of_payments: paymentPlan.numberOfPayments,
        p_payment_interval: paymentPlan.paymentInterval,
        p_downpayment_amount: Math.round(Money.fromDollars(firstPayment.amount).toCents()),
        p_payment_schedule: convertedPaymentSchedule,
        p_stripe_customer_id: stripeCustomer.id,
        p_idempotency_key: idempotencyKey,
        p_notes: paymentPlan.notes || null
      });

    console.log('Payment plan created:', {
      success: !!dbPlan,
      error: dbError,
      planData: dbPlan
    });

    if (dbError || !dbPlan) {
      console.error('create-payment-intent-and-plan-id: Database error:', dbError);
      throw new Error('Failed to create payment plan in database');
    }

    console.log('create-payment-intent-and-plan-id: Database plan created:', dbPlan);

    if (dbPlan) {
      const { error: stateError } = await supabase
        .from('payment_plan_states')
        .insert({
          payment_plan_id: dbPlan[0].payment_plan_id,
          status: 'draft'
        });

      if (stateError) {
        console.error('Error creating payment plan state:', stateError);
        throw stateError;
      }
    }

    const paymentAmount = Money.fromDollars(firstPayment.amount).toCents();
    const metadata = {
      payment_plan_id: dbPlan[0].payment_plan_id,
      is_downpayment: firstPayment.is_downpayment.toString(),
      transaction_id: dbPlan[0].first_transaction_id
    };
    
    console.log('create-payment-intent-and-plan-id: Setting metadata:', metadata);

    paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      application_fee_amount: Math.round(paymentAmount * (Number(process.env.FEE_PERCENTAGE || 2) / 100)),
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata
    });

    console.log('create-payment-intent-and-plan-id: Created PaymentIntent:', paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      stripeCustomerId: stripeCustomer.id,
      paymentPlanId: dbPlan[0].payment_plan_id
    });

  } catch (error: any) {
    console.error("create-payment-intent-and-plan-id: Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
