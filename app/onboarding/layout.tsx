import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Call cookies() to opt out of caching
  cookies()
  const supabase = await createClient()

  // Use getUser() for secure token validation
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/sign-in')
  }

  // Check if user has already completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', user.id)
    .single();

  if (profile?.is_onboarded) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-background">
      {children}
    </main>
  )
}
