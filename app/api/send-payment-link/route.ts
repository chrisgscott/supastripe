import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/utils/core-email-service';
import { Money } from '@/utils/currencyUtils';
import { formatPaymentScheduleHtml } from '@/app/utils/email-utils';
import { addDays } from 'date-fns';

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();
  const LINK_EXPIRATION_DAYS = 7;

  try {
    // Update plan state to pending_payment
    const { error: stateError } = await supabase
      .from('payment_plan_states')
      .update({ status: 'pending_payment' })
      .eq('payment_plan_id', paymentPlanId);

    if (stateError) throw stateError;

    // Fetch payment plan details with the same query structure as the original route
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        notes,
        customers (name, email),
        transactions (amount, due_date, is_downpayment),
        payment_plan_states (status)
      `)
      .eq('id', paymentPlanId)
      .single();

    if (paymentPlanError) throw paymentPlanError;
    if (!paymentPlan) {
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    // Fetch business details
    const { data: businessInfo, error: businessError } = await supabase
      .from('profiles')
      .select('business_name, support_email, support_phone')
      .single();

    if (businessError) throw businessError;

    const expirationDate = addDays(new Date(), LINK_EXPIRATION_DAYS);

    const emailTemplate = {
      templateId: 3, // New template ID for payment links
      params: {
        business_name: businessInfo.business_name,
        business_phone: businessInfo.support_phone,
        business_email: businessInfo.support_email,
        plan_id: paymentPlan.id,
        date: new Date().toLocaleDateString(),
        customer_name: paymentPlan.customers.name,
        customer_email: paymentPlan.customers.email,
        total_amount: Money.fromCents(paymentPlan.total_amount).toString(),
        number_of_payments: `${paymentPlan.number_of_payments} ${paymentPlan.payment_interval} payments`,
        payment_schedule_html: formatPaymentScheduleHtml(paymentPlan.transactions),
        notes_html: paymentPlan.notes?.content || '',
        payment_link: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${paymentPlanId}`,
        expiration_date: expirationDate.toLocaleDateString(),
      }
    };

    const success = await sendEmail(
      paymentPlan.customers.email, 
      emailTemplate.templateId, 
      emailTemplate.params
    );

    // Log the email attempt with the same structure as the original route
    const idempotencyKey = `payment_link_${paymentPlanId}_${new Date().toISOString().split('T')[0]}`;
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        email_type: 'payment_link',
        recipient_email: paymentPlan.customers.email,
        status: success ? 'sent' : 'failed',
        related_id: paymentPlanId,
        related_type: 'payment_plan',
        idempotency_key: idempotencyKey
      });

    if (logError) {
      console.error('Error logging email attempt:', logError);
    }

    if (success) {
      return NextResponse.json({ message: 'Payment link sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send payment link' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending payment link:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}