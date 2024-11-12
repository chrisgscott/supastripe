import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { Money } from '@/utils/currencyUtils';
import { Database } from "@/types/supabase";
import { calculateApplicationFee } from '@/utils/feeUtils';

type PaymentIntervalType = Database['public']['Enums']['payment_interval_type'];
type TransactionType = Database['public']['Enums']['transaction_type'];

interface PaymentScheduleItem {
  date: string;
  amount: { cents: number };
  transaction_type: TransactionType;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

// First, let's define the valid payment intervals
const VALID_PAYMENT_INTERVALS = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

export async function POST(request: Request) {
  console.log('create-downpayment-intent-and-pending-records: POST request received');
  const supabase = createClient();
  let stripeCustomer: Stripe.Customer | undefined;
  let paymentIntent: Stripe.PaymentIntent | undefined;
  let pendingPaymentPlanId: string | undefined;

  try {
    // Start a Supabase transaction
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate unique IDs first
    pendingPaymentPlanId = crypto.randomUUID();
    const pendingCustomerId = crypto.randomUUID();
    const pendingTransactionId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();

    const paymentPlan = await request.json();
    const firstPayment = paymentPlan.paymentSchedule[0];
    firstPayment.transaction_type = 'downpayment';

    console.log('create-downpayment-intent-and-pending-records: Received payment plan:', paymentPlan);

    console.log('create-downpayment-intent-and-pending-records: Authenticated user:', user.id);

    // Retrieve the connected account ID
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (stripeAccountError || !stripeAccount?.stripe_account_id) {
      console.error('create-downpayment-intent-and-pending-records: Stripe account not found:', stripeAccountError);
      throw new Error('Stripe account not connected for this user');
    }

    console.log('create-downpayment-intent-and-pending-records: Retrieved Stripe account:', stripeAccount.stripe_account_id);

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

    console.log('create-downpayment-intent-and-pending-records: Stripe customer:', stripeCustomer.id);

    // Convert payment schedule amounts to cents and ensure transaction types
    const convertedPaymentSchedule = paymentPlan.paymentSchedule.map((payment: PaymentScheduleItem) => ({
      date: new Date(payment.date).toISOString(),
      amount: payment.amount.cents,
      transaction_type: payment.transaction_type satisfies TransactionType
    }));

    console.log('Converted payment schedule:', convertedPaymentSchedule);

    // Proceed with creating the pending payment records
    const { error: dbError } = await supabase
      .rpc('create_pending_payment_records', {
        p_customer_id: pendingCustomerId,
        p_payment_plan_id: pendingPaymentPlanId,
        p_transaction_id: pendingTransactionId,
        p_customer_name: paymentPlan.customerName,
        p_customer_email: paymentPlan.customerEmail,
        p_user_id: user.id,
        p_total_amount: paymentPlan.totalAmount.cents,
        p_number_of_payments: paymentPlan.numberOfPayments,
        p_payment_interval: paymentPlan.paymentInterval.toLowerCase(),
        p_downpayment_amount: paymentPlan.downpaymentAmount.cents,
        p_payment_schedule: convertedPaymentSchedule,
        p_stripe_customer_id: stripeCustomer.id,
        p_idempotency_key: idempotencyKey,
        p_notes: paymentPlan.notes || null
      });

    if (dbError) {
      console.error('Database error creating pending records:', dbError);
      return NextResponse.json({ 
        error: 'Failed to create payment records',
        details: dbError.message 
      }, { status: 500 });
    }

    console.log('create-downpayment-intent-and-pending-records: Successfully created pending records');

    const paymentAmount = firstPayment.amount.cents;
    const metadata = {
      pending_payment_plan_id: pendingPaymentPlanId,
      pending_transaction_id: pendingTransactionId,
      pending_customer_id: pendingCustomerId,
      transaction_type: 'downpayment'
    };

    // Create Stripe payment intent with our IDs in metadata
    paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      application_fee_amount: calculateApplicationFee(Money.fromCents(firstPayment.amount.cents)),
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata
    }, {
      idempotencyKey
    });

    console.log('create-downpayment-intent-and-pending-records: Created PaymentIntent:', paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      stripeCustomerId: stripeCustomer.id,
      paymentPlanId: pendingPaymentPlanId
    });

  } catch (error) {
    // If we created database records but Stripe failed, clean them up
    if (pendingPaymentPlanId && error instanceof Stripe.errors.StripeError && !paymentIntent) {
      console.error('Stripe error, cleaning up database records');
      const { error: cleanupError } = await supabase.rpc('cleanup_pending_payment_records', {
        p_pending_plan_id: pendingPaymentPlanId
      });
      
      if (cleanupError) {
        console.error('Failed to cleanup after Stripe error:', cleanupError);
      }
    }

    console.error('create-downpayment-intent-and-pending-records: Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        type: error instanceof Stripe.errors.StripeError ? 'stripe_error' : 'server_error'
      }, 
      { status: 500 }
    );
  }
}
