import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface PaymentScheduleItem {
  amount: number;
  date: string;
}

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const {
      customerName,
      customerEmail,
      totalAmount,
      numberOfPayments,
      paymentInterval,
      downpaymentAmount,
      paymentSchedule
    } = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Create the customer first
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: customerName,
        email: customerEmail,
        user_id: user.id
      })
      .select()
      .single();

    if (customerError) {
      throw new Error(customerError.message);
    }

    // Create the payment plan in the database
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .insert({
        customer_id: customer.id,
        user_id: user.id,
        total_amount: totalAmount,
        number_of_payments: numberOfPayments,
        payment_interval: paymentInterval,
        downpayment_amount: downpaymentAmount,
        status: 'created'
      })
      .select()
      .single();

    if (paymentPlanError) {
      throw new Error(paymentPlanError.message);
    }

    // Create transactions for the payment schedule
    const transactions = paymentSchedule.map((payment: PaymentScheduleItem) => ({
      payment_plan_id: paymentPlan.id,
      amount: payment.amount,
      due_date: payment.date,
      status: 'pending',
      user_id: user.id  // Add this line to include the user_id
    }));

    const { error: transactionsError } = await supabase
      .from('transactions')
      .insert(transactions);

    if (transactionsError) {
      throw new Error(transactionsError.message);
    }

    return NextResponse.json({ paymentPlanId: paymentPlan.id });
  } catch (error: any) {
    console.error("Error creating payment plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
