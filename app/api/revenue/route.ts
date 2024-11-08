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

    let query = supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'completed')
      .eq('user_id', user.id);
      
    if (days !== 'all') {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days || '30'));
      query = query.gte('paid_at', daysAgo.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const revenue = data.reduce((sum, transaction) => sum + transaction.amount, 0);

    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
  }
}
