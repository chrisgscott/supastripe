import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface Customer {
  name: string;
  email: string;
}

interface PaymentPlan {
  id: string;
  customers: Customer;
}

interface Transaction {
  id: string;
  amount: number;
  next_attempt_date: string | null;
  payment_plans: {
    id: string;
    customers: {
      name: string;
      email: string;
    };
  };
}

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
          )
        )
      `)
      .eq('status', 'failed')
      .order('next_attempt_date', { ascending: true })
      .limit(5);

    if (error) throw error;

    console.log('Raw failed transactions from Supabase:', JSON.stringify(failedTransactions, null, 2));

    const formattedFailedTransactions = failedTransactions.map((transaction: any) => {
      const customer = transaction.payment_plans.customers;
      const formattedTransaction = {
        id: transaction.id,
        customerName: customer.name || 'Unknown',
        amount: transaction.amount,
        nextAttempt: transaction.next_attempt_date || null,
        email: customer.email || 'Unknown',
      };
      console.log('Formatted transaction:', JSON.stringify(formattedTransaction, null, 2));
      return formattedTransaction;
    });

    console.log('All formatted failed transactions:', JSON.stringify(formattedFailedTransactions, null, 2));

    return NextResponse.json(formattedFailedTransactions);
  } catch (error) {
    console.error('Error fetching failed transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch failed transactions' }, { status: 500 });
  }
}
