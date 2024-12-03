import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string }
}) {
  const { token_hash, type } = searchParams

  if (!token_hash) {
    redirect('/sign-in?message=Missing confirmation token')
  }

  // Call cookies() to opt out of caching
  cookies()
  const supabase = await createClient()

  if (type === 'signup') {
    // Get the session to see if the user is already confirmed
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (session) {
      // Update the user's custom claims
      await supabase.auth.updateUser({
        data: { email_confirmed: true }
      })
      
      // Get onboarding status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', session.user.id)
        .single()

      // Redirect based on onboarding status
      redirect(profile?.is_onboarded ? '/dashboard' : '/onboarding')
    }
  }

  // If we get here, something went wrong
  redirect('/sign-in?message=Invalid or expired confirmation token')
}
