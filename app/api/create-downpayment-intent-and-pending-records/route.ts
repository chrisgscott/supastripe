import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { formatCurrency, Money } from '@/utils/currencyUtils';
import { Database } from "@/types/supabase";

interface PaymentScheduleItem {
  date: string;
  amount: number;
  transaction_type: 'downpayment' | 'installment';
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  console.log('create-downpayment-intent-and-pending-records: POST request received');
  const supabase = createClient();
  let stripeCustomer: Stripe.Customer | undefined;
  let paymentIntent: Stripe.PaymentIntent | undefined;

  try {
    // Start a Supabase transaction
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Start a transaction
    const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
    if (transactionError) throw transactionError;

    try {
      // Generate unique IDs first
      const pendingCustomerId = crypto.randomUUID();
      const pendingPaymentPlanId = crypto.randomUUID();
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
      const convertedPaymentSchedule = paymentPlan.paymentSchedule.map((payment: PaymentScheduleItem, index: number) => ({
        date: new Date(payment.date).toISOString(),
        amount: Money.fromDollars(payment.amount).toCents(),
        transaction_type: index === 0 ? 'downpayment' : 'installment' as const,
      }));

      console.log('Converted payment schedule:', convertedPaymentSchedule);

      // Call the database function with our pre-generated IDs
      const { error: dbError } = await supabase
        .rpc('create_pending_payment_records', {
          p_customer_id: pendingCustomerId,
          p_payment_plan_id: pendingPaymentPlanId,
          p_transaction_id: pendingTransactionId,
          p_customer_name: paymentPlan.customerName,
          p_customer_email: paymentPlan.customerEmail,
          p_user_id: user.id,
          p_total_amount: Money.fromDollars(paymentPlan.totalAmount).toCents(),
          p_number_of_payments: paymentPlan.numberOfPayments,
          p_payment_interval: paymentPlan.paymentInterval,
          p_downpayment_amount: Money.fromDollars(firstPayment.amount).toCents(),
          p_payment_schedule: convertedPaymentSchedule,
          p_stripe_customer_id: stripeCustomer.id,
          p_idempotency_key: idempotencyKey,
          p_notes: paymentPlan.notes || null
        });

      if (dbError) {
        console.error('Database error creating pending records:', dbError);
        throw new Error(`Failed to create pending records: ${dbError.message}`);
      }

      const paymentAmount = Money.fromDollars(firstPayment.amount).toCents();
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
        application_fee_amount: Math.round(paymentAmount * (Number(process.env.FEE_PERCENTAGE || 2) / 100)),
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
        metadata
      }, {
        idempotencyKey
      });

      console.log('create-downpayment-intent-and-pending-records: Created PaymentIntent:', paymentIntent.id);

      // If we got here, commit the transaction
      const { error: commitError } = await supabase.rpc('commit_transaction');
      if (commitError) throw commitError;

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        stripeCustomerId: stripeCustomer.id,
        paymentPlanId: pendingPaymentPlanId
      });

    } catch (innerError) {
      // Rollback on any error
      const { error: rollbackError } = await supabase.rpc('rollback_transaction');
      if (rollbackError) console.error('Error rolling back transaction:', rollbackError);
      throw innerError;
    }

  } catch (error: any) {
    console.error("create-downpayment-intent-and-pending-records: Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
