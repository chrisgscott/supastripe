import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');

  if (!planId) {
    return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: activities, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('entity_id', planId)
      .eq('entity_type', 'payment_plan')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activity logs:', error);
      return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error in activity logs route:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}