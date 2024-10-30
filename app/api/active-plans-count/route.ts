import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count, error } = await supabase
      .from('payment_plans')
      .select(`
        *,
        payment_plan_states!inner (
          status
        )
      `, { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('payment_plan_states.status', 'active');

    if (error) throw error;

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch active plans count' }, { status: 500 });
  }
}
