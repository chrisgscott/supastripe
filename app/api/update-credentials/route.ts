import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password } = await req.json()

  try {
    if (email && email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
    }

    if (password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    }

    return NextResponse.json({ message: 'Credentials updated successfully' })
  } catch (error) {
    console.error('Error updating credentials:', error)
    return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 })
  }
}
