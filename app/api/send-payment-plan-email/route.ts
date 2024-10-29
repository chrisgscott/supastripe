import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/utils/core-email-service';
import { formatCurrency, Money } from '@/utils/currencyUtils';
import { Tables } from '@/types/supabase';

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    // Fetch payment plan details
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (name, email),
        transactions (amount, due_date, is_downpayment)
      `)
      .eq('id', paymentPlanId)
      .eq('plan_creation_status', 'completed')
      .single();

    if (paymentPlanError) throw paymentPlanError;

    // Fetch business details
    const { data: businessInfo, error: businessError } = await supabase
      .from('profiles')
      .select('business_name, support_email, support_phone')
      .single();

    if (businessError) throw businessError;

    // Generate the payment schedule table
    const paymentScheduleTable = `
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <th style="background-color: #f2f2f2;">Date</th>
          <th style="background-color: #f2f2f2;">Amount</th>
        </tr>
        ${paymentPlan.transactions.map((payment: Tables<'transactions'>, index: number) => `
          <tr>
            <td>${payment.is_downpayment ? "Due Now" : new Date(payment.due_date).toLocaleDateString()}</td>
            <td>${Money.fromCents(payment.amount).toString()}</td>
          </tr>
        `).join('')}
      </table>
    `;

    const emailParams = {
      customer_name: paymentPlan.customers.name,
      total_amount: Money.fromCents(paymentPlan.total_amount).toString(),
      number_of_payments: paymentPlan.number_of_payments,
      payment_interval: paymentPlan.payment_interval,
      business_name: businessInfo.business_name,
      support_email: businessInfo.support_email,
      support_phone: businessInfo.support_phone,
      payment_schedule: paymentScheduleTable
    };

    console.log('Email parameters being sent to Brevo:', JSON.stringify(emailParams, null, 2));

    const success = await sendEmail(paymentPlan.customers.email, 2, emailParams);

    console.log('Response from sendEmail function:', success);

    // Create a unique idempotency key
    const idempotencyKey = `payment_plan_${paymentPlanId}_${new Date().toISOString().split('T')[0]}`;

    // Prepare log data
    const logData = {
      email_type: 'payment_plan',
      recipient_email: paymentPlan.customers.email,
      status: success ? 'sent' : 'failed',
      related_id: paymentPlanId,
      related_type: 'payment_plan',
      idempotency_key: idempotencyKey
    };

    // Log the email attempt
    const { error: logError } = await supabase
      .from('email_logs')
      .insert(logData);

    if (logError) {
      console.error('Error logging email attempt:', logError);
      // Don't throw the error, just log it
    }

    if (success) {
      return NextResponse.json({ message: 'Payment plan email sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send payment plan email' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending payment plan email:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
