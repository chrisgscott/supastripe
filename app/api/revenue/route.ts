import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Money } from '@/utils/currencyUtils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');
  const supabase = createClient();

  try {
    let query = supabase
      .from('transactions')
      .select('amount, payment_plans!inner(*)')
      .eq('status', 'paid')
      .eq('payment_plans.plan_creation_status', 'completed');

    if (days !== 'all') {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days || '30'));
      query = query.gte('created_at', daysAgo.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalMoney = Money.fromCents(data.reduce((sum, transaction) => sum + transaction.amount, 0));

    return NextResponse.json({ 
      revenue: totalMoney.toString(),
      rawRevenue: totalMoney.toCents()
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
  }
}
