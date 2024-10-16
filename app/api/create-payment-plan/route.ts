import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface PaymentScheduleItem {
  date: Date;
  amount: number;
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

    // Ensure total_amount is a number
    const totalAmount = Number(paymentPlan.totalAmount);
    if (isNaN(totalAmount)) {
      throw new Error('Invalid total amount');
    }

    // Create the payment plan in the database
    const { data: createdPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .insert({
        customer_id: customer.id,
        user_id: user.id,
        total_amount: totalAmount,
        number_of_payments: paymentPlan.numberOfPayments,
        payment_interval: paymentPlan.paymentInterval,
        downpayment_amount: paymentPlan.downpaymentAmount,
        status: 'created'
      })
      .select()
      .single();

    if (paymentPlanError) {
      throw new Error(paymentPlanError.message);
    }

    // Create transactions for the payment schedule
    const transactions = paymentPlan.paymentSchedule.map((payment: PaymentScheduleItem, index: number) => ({
      payment_plan_id: createdPlan.id,
      amount: payment.amount,
      due_date: payment.date,
      status: 'pending',
      user_id: user.id,
      is_downpayment: index === 0 && paymentPlan.downpaymentAmount > 0
    }));

    const { data: insertedTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();

    if (transactionsError) {
      throw new Error(`Failed to create transactions: ${transactionsError.message}`);
    }

    return NextResponse.json({ paymentPlanId: createdPlan.id, transactions: insertedTransactions });
  } catch (error: any) {
    console.error("Error creating payment plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
