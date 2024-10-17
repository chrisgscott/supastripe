import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('transactions')
    .select('amount, due_date')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gte('due_date', new Date().toISOString());

  if (days && days !== 'all') {
    const endDate = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);
    query = query.lte('due_date', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching scheduled revenue:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled revenue' }, { status: 500 });
  }

  const scheduledRevenue = data.reduce((sum, transaction) => sum + transaction.amount, 0);

  const formattedScheduledRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(scheduledRevenue);

  return NextResponse.json({ 
    scheduledRevenue: formattedScheduledRevenue,
    rawScheduledRevenue: scheduledRevenue
  });
}
