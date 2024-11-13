import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check both regular and pending payment plans
    const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
      supabase
        .from('payment_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('pending_payment_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
    ]);

    const hasPlans = (activeCount || 0) + (pendingCount || 0) > 0;

    return NextResponse.json({ 
      hasPaymentPlans: hasPlans,
      activeCount: activeCount || 0,
      pendingCount: pendingCount || 0
    });
  } catch (error) {
    console.error('Error in check-payment-plans:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}