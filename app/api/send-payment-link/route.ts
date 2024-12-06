import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/utils/core-email-service';
import { Money } from '@/utils/currencyUtils';
import { formatPaymentScheduleHtml } from '@/app/utils/email-utils';
import { addDays } from 'date-fns';
import { Database } from '@/types/supabase';

const LINK_EXPIRATION_DAYS = 7;

type EmailLog = Database['public']['Tables']['email_logs']['Insert'];
type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];

type TransactionForEmail = Pick<Transaction, 
  'amount' | 
  'due_date' | 
  'transaction_type' | 
  'id' | 
  'created_at' | 
  'last_reminder_email_log_id' | 
  'next_attempt_date' | 
  'paid_at' | 
  'payment_plan_id' | 
  'status' | 
  'stripe_payment_intent_id' | 
  'user_id' |
  'reminder_email_date' |
  'updated_at'
>;

type PaymentPlanWithRelations = PaymentPlan & {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  transactions: TransactionForEmail[];
};

type PendingPlanWithRelations = Database['public']['Tables']['pending_payment_plans']['Row'] & {
  pending_customers: {
    id: string;
    name: string;
    email: string;
  };
  pending_transactions: TransactionForEmail[];
};

type PendingTransaction = {
  amount: number;
  due_date: string;
  transaction_type: string;
  id?: string;
  created_at?: string;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First try to fetch from payment_plans
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customer (
          id,
          name,
          email
        ),
        transactions (
          id,
          amount,
          due_date,
          transaction_type,
          created_at,
          status
        )
      `)
      .eq('id', paymentPlanId)
      .eq('user_id', user.id)
      .single();

    // If not found in payment_plans, try pending_payment_plans
    if (!paymentPlan) {
      const { data: pendingPlan, error: pendingPlanError } = await supabase
        .from('pending_payment_plans')
        .select(`
          *,
          pending_customers!customer_id (
            id,
            name,
            email
          ),
          pending_transactions (
            id,
            amount,
            due_date,
            transaction_type,
            created_at
          )
        `)
        .eq('id', paymentPlanId)
        .eq('user_id', user.id)
        .single();

      if (pendingPlanError || !pendingPlan) {
        console.error('Error fetching plan:', pendingPlanError);
        return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
      }

      console.log('Pending plan data:', {
        id: pendingPlan?.id,
        hasCustomers: !!pendingPlan?.pending_customers,
        customersType: typeof pendingPlan?.pending_customers,
        customersLength: pendingPlan?.pending_customers?.length,
        rawCustomers: pendingPlan?.pending_customers,
        hasTransactions: !!pendingPlan?.pending_transactions,
        transactionsLength: pendingPlan?.pending_transactions?.length
      });
      
      // Transform pending plan data to match payment plan structure
      console.log('Transforming pending plan:', {
        customersBeforeMap: pendingPlan.pending_customers,
        transactionsBeforeMap: pendingPlan.pending_transactions
      });

      try {
        return handleEmailSend({
          ...pendingPlan,
          customer: {
            name: pendingPlan.pending_customers.name,
            email: pendingPlan.pending_customers.email
          },
          transactions: pendingPlan.pending_transactions.map((t: PendingTransaction) => ({
            ...t,
            id: t.id || crypto.randomUUID(),
            created_at: t.created_at || new Date().toISOString(),
            last_reminder_email_log_id: null,
            next_attempt_date: null,
            paid_at: null,
            payment_plan_id: pendingPlan.id,
            status: 'pending_payment' satisfies PaymentStatusType,
            stripe_payment_intent_id: null,
            user_id: user.id,
            reminder_email_date: null,
            updated_at: new Date().toISOString()
          }))
        }, user.id, supabase);
      } catch (error) {
        console.error('Error transforming pending plan:', error);
        throw error;
      }
    }

    // Handle regular payment plan
    return handleEmailSend(paymentPlan, user.id, supabase);
  } catch (error) {
    console.error('Error sending payment link:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

async function handleEmailSend(
  plan: PaymentPlanWithRelations | PendingPlanWithRelations,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_name, support_email, support_phone')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return NextResponse.json({ error: 'Business profile not found' }, { status: 404 });
  }

  const isPendingPlan = 'pending_customers' in plan;
  console.log('Plan type:', isPendingPlan ? 'pending' : 'active');
  console.log('Customers:', isPendingPlan ? plan.pending_customers : plan.customer);

  const customerName = isPendingPlan 
    ? plan.pending_customers.name
    : plan.customer.name;

  const customerEmail = isPendingPlan
    ? plan.pending_customers.email
    : plan.customer.email;

  console.log('Customer details:', { customerName, customerEmail });

  if (!customerEmail) {
    console.error('Customer email is missing');
    return NextResponse.json({ error: 'Customer email is required' }, { status: 400 });
  }

  const transactions = isPendingPlan ? plan.pending_transactions : plan.transactions;

  const expirationDate = addDays(new Date(), LINK_EXPIRATION_DAYS);

  const emailTemplate = {
    templateId: 3,
    params: {
      business_name: profile.business_name,
      business_phone: profile.support_phone,
      business_email: profile.support_email,
      plan_id: plan.id,
      date: new Date().toLocaleDateString(),
      customer_name: customerName,
      customer_email: customerEmail,
      total_amount: Money.fromCents(plan.total_amount).toString(),
      number_of_payments: `${plan.number_of_payments} ${plan.payment_interval} payments`,
      payment_link: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${plan.id}`,
      expiration_date: expirationDate.toLocaleDateString(),
    }
  };

  const success = await sendEmail(
    customerEmail,
    emailTemplate.templateId,
    emailTemplate.params
  );

  if (success && isPendingPlan) {
    const { error: updateError } = await supabase
      .from('pending_payment_plans')
      .update({ status: 'pending_approval' })
      .eq('id', plan.id);

    if (updateError) {
      console.error('Error updating plan status:', updateError);
    }
  }

  // Log the email attempt
  const emailLog: EmailLog = {
    email_type: 'payment_link',
    recipient_email: customerEmail,
    status: success ? 'sent' : 'failed',
    related_id: plan.id,
    related_type: isPendingPlan ? 'pending_payment_plan' : 'payment_plan',
    idempotency_key: `payment_link_${plan.id}_${new Date().toISOString().split('T')[0]}`,
    user_id: userId
  };

  const { error: emailLogError } = await supabase
    .from('email_logs')
    .insert(emailLog);

  if (emailLogError) {
    console.error('Error logging email:', emailLogError);
  }

  // Publish event
  const customerId = isPendingPlan ? plan.pending_customers.id : plan.customer.id;
  const { error: eventError } = await supabase.rpc('publish_activity', {
    p_event_type: 'plan_payment_link_sent',
    p_entity_type: 'payment_plan',
    p_entity_id: plan.id,
    p_user_id: userId,
    p_metadata: {
      recipient: customerEmail,
      email_type: 'payment_link'
    },
    p_customer_id: customerId
  });

  if (eventError) {
    console.error('Error publishing event:', eventError);
    return NextResponse.json({ error: 'Failed to log email activity' }, { status: 500 });
  }

  if (success) {
    return NextResponse.json({ message: 'Payment link sent successfully' });
  } else {
    return NextResponse.json({ error: 'Failed to send payment link' }, { status: 500 });
  }
}