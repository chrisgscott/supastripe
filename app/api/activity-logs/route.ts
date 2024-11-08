import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';

const ITEMS_PER_PAGE = 10;

type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

interface ActivityResponse {
  activities: ActivityLog[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: typeof ITEMS_PER_PAGE;
  };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const offset = (page - 1) * ITEMS_PER_PAGE;

  try {
    const { data: activities, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (error) {
      console.error('Error fetching activity logs:', error);
      return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }

    const { count, error: countError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error getting count:', countError);
      return NextResponse.json({ error: 'Failed to get total count' }, { status: 500 });
    }

    const response: ActivityResponse = {
      activities,
      pagination: {
        total: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
        itemsPerPage: ITEMS_PER_PAGE
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in activity logs route:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}