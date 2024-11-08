import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();

    // Only get pending transactions from active payment plans
    let query = supabase
      .from('transactions')
      .select(`
        amount,
        payment_plans!inner (
          status
        )
      `)
      .eq('status', 'pending')
      .eq('user_id', user.id)
      .eq('payment_plans.status', 'active')
      .gte('due_date', today.toISOString());

    // Only add the upper date limit if we're not looking at all time
    if (days !== 'all') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days || '30'));
      query = query.lte('due_date', futureDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    const scheduledRevenue = data.reduce((sum, transaction) => sum + transaction.amount, 0);

    return NextResponse.json({ scheduledRevenue });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled revenue' }, { status: 500 });
  }
}
