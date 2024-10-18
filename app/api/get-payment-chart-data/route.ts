// TODO: Fix current month forecasted revenue
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { startOfMonth, endOfMonth, format, isBefore, isAfter } from 'date-fns';

interface Transaction {
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
  paid_at: string;
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

  const startDate = new Date('2023-10-16').toISOString(); // Adjust this date as needed
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, due_date, status, paid_at, created_at')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const monthlyData: Record<string, MonthlyData> = {};
  const now = new Date();

  (data as Transaction[]).forEach((transaction) => {
    let monthKey: string;
    
    if (transaction.status === 'paid') {
      if (transaction.paid_at) {
        const paidDate = new Date(transaction.paid_at);
        // Shift the month forward by one
        paidDate.setMonth(paidDate.getMonth() + 1);
        monthKey = format(startOfMonth(paidDate), 'yyyy-MM');
      } else {
        // If paid but no paid_at date, use the due_date
        const dueDate = new Date(transaction.due_date);
        // Shift the month forward by one
        dueDate.setMonth(dueDate.getMonth() + 1);
        monthKey = format(startOfMonth(dueDate), 'yyyy-MM');
      }
    } else {
      const dueDate = new Date(transaction.due_date);
      // Shift the month forward by one
      dueDate.setMonth(dueDate.getMonth() + 1);
      monthKey = format(startOfMonth(dueDate), 'yyyy-MM');
    }
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { collected: 0, forecasted: 0 };
    }

    if (transaction.status === 'paid') {
      monthlyData[monthKey].collected += transaction.amount;
    } else if (transaction.status === 'pending' && isAfter(new Date(transaction.due_date), now)) {
      monthlyData[monthKey].forecasted += transaction.amount;
    }

    console.log('Processing transaction:', {
      status: transaction.status,
      amount: transaction.amount,
      due_date: transaction.due_date,
      paid_at: transaction.paid_at,
      monthKey,
      collected: monthlyData[monthKey].collected,
      forecasted: monthlyData[monthKey].forecasted
    });
  });

  const chartData = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      collected: data.collected,
      forecasted: data.forecasted
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  console.log('Monthly Data:', JSON.stringify(monthlyData, null, 2));
  console.log('Chart Data:', JSON.stringify(chartData, null, 2));

  return NextResponse.json(chartData);
}
