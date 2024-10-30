import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/types/supabase';
import { Money } from '@/utils/currencyUtils';

type FailedTransaction = {
  id: string;
  amount: number;
  next_attempt_date: string | null;
  payment_plans: {
    id: string;
    customers: {
      name: string;
      email: string;
    };
    payment_plan_states: {
      status: string;
    };
  };
};

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: failedTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        next_attempt_date,
        payment_plans!inner (
          id,
          customers!inner (
            name,
            email
          ),
          payment_plan_states!inner (
            status
          )
        )
      `)
      .eq('status', 'failed')
      .eq('payment_plans.payment_plan_states.status', 'completed')
      .order('next_attempt_date', { ascending: true })
      .limit(5);

    if (error) throw error;

    const formattedFailedTransactions = (failedTransactions as unknown as FailedTransaction[]).map((transaction) => ({
      id: transaction.id,
      customerName: transaction.payment_plans.customers.name || 'Unknown',
      amount: Money.fromCents(transaction.amount).toString(),
      rawAmount: transaction.amount,
      nextAttempt: transaction.next_attempt_date || null,
      email: transaction.payment_plans.customers.email || 'Unknown',
    }));

    return NextResponse.json(formattedFailedTransactions);
  } catch (error) {
    console.error('Error fetching failed transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch failed transactions' }, { status: 500 });
  }
}
