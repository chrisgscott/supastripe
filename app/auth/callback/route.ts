import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function GET(request: Request) {
  console.log('=== Auth Callback Started ===');
  const requestUrl = new URL(request.url);
  console.log('Callback URL:', requestUrl.pathname + requestUrl.search);
  
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || '/dashboard';
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  console.log('URL Parameters:', {
    hasCode: !!code,
    next,
    error,
    error_description
  });

  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_SITE_URL 
    : 'http://localhost:3000';
  
  // Log request details
  const headerObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Skip logging sensitive headers
    if (!['cookie', 'authorization'].includes(key.toLowerCase())) {
      headerObj[key] = value;
    }
  });
  console.log('Request headers:', headerObj);

  // Log cookies safely
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  console.log('Incoming cookies:', allCookies.map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') || c.name.includes('auth') ? '[REDACTED]' : c.value
  })));

  if (error || error_description) {
    console.error('OAuth error in callback:', { error, error_description });
    return NextResponse.redirect(`${baseUrl}/sign-in?error=oauth_error&description=${error_description}`);
  }

  if (!code) {
    console.error('No authorization code present in callback URL');
    return NextResponse.redirect(`${baseUrl}/sign-in?error=no_code`);
  }

  try {
    const supabase = createClient();
    console.log('Attempting to exchange code for session...');
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Session exchange error:', {
        name: error.name,
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_error`);
    }

    if (!data.session) {
      console.error('No session returned after code exchange');
      return NextResponse.redirect(`${baseUrl}/sign-in?error=no_session`);
    }

    // Get user details
    console.log('Getting user details...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user after session exchange:', userError);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=user_error`);
    }

    // Check if profile exists, create if it doesn't
    const serviceRoleClient = createClient(true);
    const { data: profile } = await serviceRoleClient
      .from('profiles')
      .select()
      .eq('id', user.id)
      .single();

    if (!profile) {
      const { error: profileError } = await serviceRoleClient
        .from('profiles')
        .insert([
          { 
            id: user.id,
            is_onboarded: false
          }
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return NextResponse.redirect(`${baseUrl}/sign-in?error=profile_creation_failed`);
      }
    }

    console.log('Authentication successful:', {
      userId: user.id,
      email: user.email,
      provider: user.app_metadata.provider,
      isNewUser: user.created_at === user.last_sign_in_at,
      emailConfirmed: user.email_confirmed_at,
      sessionExpires: data.session.expires_at
    });

    // Create response with redirect
    const response = NextResponse.redirect(`${baseUrl}${next}`);

    // Log final cookies
    const finalCookies = cookieStore.getAll();
    console.log('Final cookies being set:', finalCookies.map(c => ({ 
      name: c.name, 
      value: c.name.includes('code-verifier') || c.name.includes('auth') ? '[REDACTED]' : c.value
    })));
    
    // Set cookies in response
    finalCookies.forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, {
        domain: 'localhost',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
    });

    console.log('=== Auth Callback Completed Successfully ===');
    return response;
  } catch (error) {
    console.error('Unexpected error in callback:', error);
    return NextResponse.redirect(`${baseUrl}/sign-in?error=unexpected`);
  }
}
