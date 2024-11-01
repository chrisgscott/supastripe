import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/utils/core-email-service';
import { Money } from '@/utils/currencyUtils';
import { formatPaymentScheduleHtml } from '@/app/utils/email-utils';
import { addDays } from 'date-fns';
import { Database } from '@/types/supabase';

type EmailLog = Database['public']['Tables']['email_logs']['Insert'];
type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();
  const LINK_EXPIRATION_DAYS = 7;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch payment plan with related data
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          name,
          email
        ),
        transactions (
          amount,
          due_date,
          transaction_type
        )
      `)
      .eq('id', paymentPlanId)
      .eq('user_id', user.id)
      .single();

    if (paymentPlanError || !paymentPlan) {
      console.error('Error fetching payment plan:', paymentPlanError);
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    // Fetch business profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_name, support_email, support_phone')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Business profile not found' }, { status: 404 });
    }

    const expirationDate = addDays(new Date(), LINK_EXPIRATION_DAYS);

    const emailTemplate = {
      templateId: 3,
      params: {
        business_name: profile.business_name,
        business_phone: profile.support_phone,
        business_email: profile.support_email,
        plan_id: paymentPlan.id,
        date: new Date().toLocaleDateString(),
        customer_name: paymentPlan.customers.name,
        customer_email: paymentPlan.customers.email,
        total_amount: Money.fromCents(paymentPlan.total_amount).toString(),
        number_of_payments: `${paymentPlan.number_of_payments} ${paymentPlan.payment_interval} payments`,
        payment_schedule_html: formatPaymentScheduleHtml(paymentPlan.transactions),
        payment_link: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${paymentPlanId}`,
        expiration_date: expirationDate.toLocaleDateString(),
      }
    };

    const success = await sendEmail(
      paymentPlan.customers.email,
      emailTemplate.templateId,
      emailTemplate.params
    );

    // Log the email attempt
    const emailLog: EmailLog = {
      email_type: 'payment_link',
      recipient_email: paymentPlan.customers.email,
      status: success ? 'sent' : 'failed',
      related_id: paymentPlanId,
      related_type: 'payment_plan',
      idempotency_key: `payment_link_${paymentPlanId}_${new Date().toISOString().split('T')[0]}`,
      user_id: user.id
    };

    const { error: logError } = await supabase
      .from('email_logs')
      .insert(emailLog);

    if (logError) {
      console.error('Error logging email:', logError);
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