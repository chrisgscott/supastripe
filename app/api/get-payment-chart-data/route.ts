import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { startOfMonth, format } from 'date-fns';
import { Tables } from '@/types/supabase';
import { Money } from '@/utils/currencyUtils';

type Transaction = Tables<'transactions'>;

interface MonthlyData {
  collected: Money;
  forecasted: Money;
}

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, due_date, status, paid_at')
    .eq('user_id', user.id)
    .eq('plan_creation_status', 'completed')
    .in('status', ['paid', 'pending'])
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const monthlyData: Record<string, MonthlyData> = {};

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set to start of day

  (data as Transaction[]).forEach((transaction) => {
    const dueDate = new Date(transaction.due_date);
    dueDate.setHours(0, 0, 0, 0); // Set to start of day
    
    // Shift the month forward by one for display purposes
    dueDate.setMonth(dueDate.getMonth() + 1);
    const monthKey = format(startOfMonth(dueDate), 'yyyy-MM');
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        collected: Money.fromCents(0),
        forecasted: Money.fromCents(0)
      };
    }

    if (transaction.status === 'paid') {
      monthlyData[monthKey].collected = monthlyData[monthKey].collected.add(Money.fromCents(transaction.amount));
    } else if (transaction.status === 'pending') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      // Use original date (before shift) for comparison
      const originalDueDate = new Date(transaction.due_date);
      originalDueDate.setHours(0, 0, 0, 0);
      
      if (originalDueDate > now) {
        monthlyData[monthKey].forecasted = monthlyData[monthKey].forecasted.add(Money.fromCents(transaction.amount));
      }
    }
  });

  // Convert to chart data format with dollars instead of cents
  const chartData = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      collected: data.collected.toDollars(),
      forecasted: data.forecasted.toDollars()
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  console.log('Chart Data:', chartData);
  return NextResponse.json(chartData);
}
