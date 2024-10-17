import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { count, error } = await supabase
    .from('payment_plans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching active plans count:', error);
    return NextResponse.json({ error: 'Failed to fetch active plans count' }, { status: 500 });
  }

  return NextResponse.json({ count });
}