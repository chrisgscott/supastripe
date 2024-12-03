import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Call cookies() to opt out of caching
  cookies()
  const supabase = await createClient()

  // Use getUser() for secure token validation
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Auth error:', error.message)
    redirect('/sign-in?error=auth_error')
  }
  
  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="flex-1">
      {children}
    </div>
  )
}
