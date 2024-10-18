import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return NextResponse.json({ firstName: data.first_name })
  } catch (error) {
    console.error('Error fetching user name:', error)
    return NextResponse.json({ error: 'Failed to fetch user name' }, { status: 500 })
  }
}
