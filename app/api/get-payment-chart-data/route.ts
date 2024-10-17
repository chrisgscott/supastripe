import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { startOfMonth, endOfMonth, format, isBefore } from 'date-fns';

interface Transaction {
  amount: number;
  due_date: string;
  status: string;
}

interface MonthlyData {
  collected: number;
  forecasted: number;
}

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, due_date, status')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const monthlyData: Record<string, MonthlyData> = {};

  (data as Transaction[]).forEach((transaction) => {
    const dueDate = new Date(transaction.due_date);
    const monthKey = format(startOfMonth(dueDate), 'yyyy-MM');
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { collected: 0, forecasted: 0 };
    }

    if (transaction.status === 'paid' || (transaction.status === 'pending' && isBefore(dueDate, new Date()))) {
      monthlyData[monthKey].collected += transaction.amount;
    } else if (transaction.status === 'pending') {
      monthlyData[monthKey].forecasted += transaction.amount;
    }
  });

  const chartData = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      collected: data.collected,
      forecasted: data.forecasted
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json(chartData);
}
