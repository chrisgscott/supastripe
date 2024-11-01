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
    .select(`
      amount,
      due_date,
      status,
      paid_at,
      transaction_type
    `)
    .eq('user_id', user.id)
    .in('status', ['completed', 'pending'])
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const monthlyData: Record<string, MonthlyData> = {};

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set to start of day

  (data as Transaction[]).forEach((transaction) => {
    const scheduleDate = new Date(transaction.due_date);
    scheduleDate.setHours(0, 0, 0, 0); // Set to start of day
    
    // Shift the month forward by one for display purposes
    scheduleDate.setMonth(scheduleDate.getMonth() + 1);
    const monthKey = format(startOfMonth(scheduleDate), 'yyyy-MM');
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        collected: Money.fromCents(0),
        forecasted: Money.fromCents(0)
      };
    }

    if (transaction.status === 'completed') {
      monthlyData[monthKey].collected = monthlyData[monthKey].collected.add(Money.fromCents(transaction.amount));
    } else if (transaction.status === 'pending') {
      const originalScheduleDate = new Date(transaction.due_date);
      originalScheduleDate.setHours(0, 0, 0, 0);
      
      if (originalScheduleDate > now) {
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
