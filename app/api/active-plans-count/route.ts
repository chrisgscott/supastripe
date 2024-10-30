import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  try {
    const { count, error } = await supabase
      .from('payment_plans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('plan_creation_status', 'completed');

    if (error) throw error;

    return NextResponse.json({ activePlans: count });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch active plans count' }, { status: 500 });
  }
}
