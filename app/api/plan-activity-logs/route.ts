import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';

type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');

  console.log('plan-activity-logs: Fetching activities for plan:', planId);

  if (!planId) {
    console.log('plan-activity-logs: No planId provided');
    return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    console.log('plan-activity-logs: Auth error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('plan-activity-logs: Querying activities with:', {
      user_id: user.id,
      entity_id: planId,
      entity_type: 'payment_plan'
    });

    const { data: activities, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('entity_id', planId)
      .or('entity_type.eq.payment_plan,entity_type.eq.pending_payment_plan')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('plan-activity-logs: Error fetching activities:', error);
      return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }

    console.log('plan-activity-logs: Raw activities:', JSON.stringify(activities, null, 2));
    console.log('plan-activity-logs: Activity types:', activities?.map((a: ActivityLog) => a.activity_type));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('plan-activity-logs: Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}