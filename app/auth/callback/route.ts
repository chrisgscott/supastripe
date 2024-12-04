import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  // Call cookies() to opt out of caching
  cookies()
  
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const code = searchParams.get('code')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!baseUrl) {
    console.error('NEXT_PUBLIC_SITE_URL is not set')
    return NextResponse.redirect('/error')
  }

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  if (token_hash && type) {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_error`)
}
