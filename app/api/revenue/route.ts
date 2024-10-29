import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Money } from '@/utils/currencyUtils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let startDate = null;
  if (days && days !== 'all') {
    startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
  }

  const query = supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .neq('status', 'failed')
    .eq('plan_creation_status', 'completed');

  if (startDate) {
    query.gte('created_at', startDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching revenue:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
  }

  const totalMoney = Money.fromCents(data.reduce((sum, transaction) => sum + transaction.amount, 0));

  return NextResponse.json({ 
    revenue: totalMoney.toString(),
    rawRevenue: totalMoney.toCents()
  });
}
