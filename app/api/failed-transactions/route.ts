import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Money } from '@/utils/currencyUtils';
import { Database } from "@/types/supabase";

type TransactionStatusType = Database['public']['Enums']['transaction_status_type'];

type FailedTransaction = {
  id: string;
  amount: number;
  next_attempt_date: string | null;
  payment_plan: {
    customer: {
      name: string;
      email: string;
    }
  }
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
        payment_plan:payment_plan_id (
          customer:customer_id (
            name,
            email
          )
        )
      `)
      .eq('status', 'failed' satisfies TransactionStatusType)
      .eq('user_id', user.id)
      .order('next_attempt_date', { ascending: true })
      .limit(5);

    if (error) throw error;

    const formattedFailedTransactions = (failedTransactions as unknown as FailedTransaction[]).map((transaction) => ({
      id: transaction.id,
      customerName: transaction.payment_plan.customer.name,
      amount: transaction.amount,
      nextAttempt: transaction.next_attempt_date,
      email: transaction.payment_plan.customer.email
    }));

    return NextResponse.json(formattedFailedTransactions);
  } catch (error) {
    console.error('Error fetching failed transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch failed transactions' }, { status: 500 });
  }
}
