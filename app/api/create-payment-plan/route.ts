import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

interface PaymentScheduleItem {
  date: Date;
  amount: number;
  is_downpayment: boolean;
}

interface PaymentPlan {
  customerId?: string;
  totalAmount: number;
  numberOfPayments: number;
  paymentInterval: string;
  downpaymentAmount: number;
  status: 'created' | 'active' | 'completed' | 'cancelled' | 'failed';
  userId?: string;
  customerName: string;
  customerEmail: string;
  paymentSchedule: PaymentScheduleItem[];
}

export async function POST(request: Request) {
  const supabase = createClient();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

  try {
    const paymentPlan = await request.json();
    console.log('Parsed payment plan:', JSON.stringify(paymentPlan, null, 2));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Create the customer first
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: paymentPlan.customerName,
        email: paymentPlan.customerEmail,
        user_id: user.id
      })
      .select()
      .single();

    if (customerError) {
      throw new Error(customerError.message);
    }

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      name: paymentPlan.customerName,
      email: paymentPlan.customerEmail,
      metadata: { supabase_customer_id: customer.id }
    });

    // Update the customer with Stripe ID
    const { error: updateError } = await supabase
      .from('customers')
      .update({ stripe_customer_id: stripeCustomer.id })
      .eq('id', customer.id);

    if (updateError) {
      throw new Error(`Error updating customer with Stripe ID: ${updateError.message}`);
    }

    // Create the payment plan in the database
    const { data: createdPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .insert({
        customer_id: customer.id,
        user_id: user.id,
        total_amount: Math.round(paymentPlan.totalAmount * 100), // Convert to cents
        number_of_payments: paymentPlan.numberOfPayments,
        payment_interval: paymentPlan.paymentInterval,
        downpayment_amount: Math.round(paymentPlan.downpaymentAmount * 100), // Also convert downpayment to cents
        status: 'created'
      })
      .select()
      .single();

    if (paymentPlanError) {
      throw new Error(paymentPlanError.message);
    }

    // Create transactions for the payment schedule
    if (!paymentPlan.paymentSchedule || paymentPlan.paymentSchedule.length === 0) {
      throw new Error('Payment schedule is empty');
    }

    const transactions = paymentPlan.paymentSchedule.map((payment: PaymentScheduleItem, index: number) => ({
      payment_plan_id: createdPlan.id,
      amount: payment.amount,
      due_date: payment.date,
      status: index === 0 ? 'pending_capture' : 'pending',
      user_id: user.id,
      is_downpayment: payment.is_downpayment
    }));

    const { data: insertedTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();

    if (transactionsError) {
      throw new Error(`Failed to create transactions: ${transactionsError.message}`);
    }

    const firstTransaction = insertedTransactions.find(t => t.status === 'pending_capture');

    return NextResponse.json({ 
      paymentPlanId: createdPlan.id, 
      transactions: insertedTransactions,
      stripeCustomerId: stripeCustomer.id,
      firstTransactionId: firstTransaction?.id
    });
  } catch (error: any) {
    console.error("Error creating payment plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
