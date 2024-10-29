import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Money } from '@/utils/currencyUtils';
import { Tables } from '@/types/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  let query = supabase
    .from('transactions')
    .select('amount, due_date')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .eq('plan_creation_status', 'completed')
    .gt('due_date', now);

  if (days && days !== 'all') {
    const endDate = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);
    query = query.lte('due_date', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching scheduled revenue:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled revenue' }, { status: 500 });
  }

  const totalMoney = Money.fromCents(data.reduce((sum, transaction) => sum + transaction.amount, 0));

  return NextResponse.json({ 
    scheduledRevenue: totalMoney.toString(),
    rawScheduledRevenue: totalMoney.toCents()
  });
}
