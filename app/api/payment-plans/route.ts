import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addWeeks, addMonths, format } from 'date-fns'
import { Tables } from '@/types/supabase'
import { Money } from '@/utils/currencyUtils'

type PaymentPlanWithRelations = Tables<'payment_plans'> & {
  customers: {
    name: string;
    email: string;
  };
  transactions: {
    due_date: string;
    status: string;
  }[];
};

export async function GET() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        status,
        created_at,
        customers (
          name,
          email
        ),
        transactions (
          due_date,
          status
        )
      `)
      .eq('plan_creation_status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
    }

    console.log('Raw data from Supabase:', JSON.stringify(data, null, 2))

    const formattedData = (data as unknown as PaymentPlanWithRelations[]).map((plan) => {
      const nextPaymentDate = calculateNextPaymentDate(plan);
      const formattedPlan = {
        id: plan.id,
        customerName: plan.customers?.name || 'Unknown',
        totalAmount: Money.fromCents(plan.total_amount || 0).toString(),
        nextPaymentDate,
        status: plan.status,
        created_at: plan.created_at
      };
      return formattedPlan;
    });

    console.log('Final formatted data:', JSON.stringify(formattedData, null, 2))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

function calculateNextPaymentDate(plan: any) {
  const pendingTransactions = plan.transactions.filter((t: any) => t.status === 'pending')
  if (pendingTransactions.length === 0) return null

  const nextDueDate = new Date(Math.min(...pendingTransactions.map((t: any) => new Date(t.due_date).getTime())))
  return format(nextDueDate, 'yyyy-MM-dd')
}

export async function POST(request: Request) {
  const supabase = createClient();
  const data = await request.json();
  const { pendingPlanId, numberOfPayments, paymentInterval, ...planDetails } = data;

  try {
    if (pendingPlanId) {
      // Fetch the pending plan
      const { data: plan, error: planError } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('id', pendingPlanId)
        .eq('plan_creation_status', 'pending')
        .single();

      if (planError) throw planError;

      // Calculate payment amounts and dates
      const totalAmount = plan.total_amount;
      const paymentAmount = Math.floor(totalAmount / numberOfPayments);
      const remainder = totalAmount % numberOfPayments;
      
      const transactions = Array.from({ length: numberOfPayments }, (_, index) => {
        const dueDate = paymentInterval === 'weekly' 
          ? addWeeks(new Date(), index + 1)
          : addMonths(new Date(), index + 1);

        return {
          payment_plan_id: plan.id,
          amount: index === 0 ? paymentAmount + remainder : paymentAmount,
          due_date: dueDate.toISOString(),
          status: 'pending'
        };
      });

      // Insert transactions
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (transactionError) throw transactionError;

      // Update plan status
      const { error: updateError } = await supabase
        .from('payment_plans')
        .update({ 
          plan_creation_status: 'completed',
          status: 'active',
          number_of_payments: numberOfPayments,
          payment_interval: paymentInterval
        })
        .eq('id', pendingPlanId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true });
    } else {
      // Handle new plan creation (existing logic)
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to process payment plan' }, { status: 500 });
  }
}
