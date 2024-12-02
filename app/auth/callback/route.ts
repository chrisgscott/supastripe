import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  console.log('Auth callback initiated');
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const baseUrl = 'http://127.0.0.1:3000';
  
  // Log all request headers
  const headerObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  console.log('Request headers:', headerObj);

  // Log all cookies
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  console.log('All cookies in callback:', allCookies.map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') ? 'present' : c.value
  })));

  if (!code) {
    console.error('No code present in callback URL');
    return NextResponse.redirect(`${baseUrl}/sign-in?error=no_code`);
  }

  try {
    const supabase = createClient();
    console.log('Exchanging code for session...');
    
    // Log the code we're trying to exchange (first 10 chars only for security)
    console.log('Auth code prefix:', code.substring(0, 10) + '...');
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', {
        name: error.name,
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_error`);
    }

    if (!data.session) {
      console.error('No session in exchange response. Full response:', data);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=no_session`);
    }

    // Get user details
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user after session exchange:', userError);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=user_error`);
    }

    console.log('Session established successfully:', {
      user: user.id,
      email: user.email,
      isNew: user.created_at === user.last_sign_in_at,
      expiresAt: data.session.expires_at
    });

    // Create a response with the redirect
    const response = NextResponse.redirect(`${baseUrl}/dashboard`);

    // Get the updated cookie store after session exchange
    const updatedCookieStore = cookies();
    const updatedCookies = updatedCookieStore.getAll();
    
    console.log('Cookies after session exchange:', updatedCookies.map(c => ({ 
      name: c.name, 
      value: c.name.includes('code-verifier') ? 'present' : c.value
    })));

    // Copy all cookies to the response
    updatedCookies.forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, {
        domain: '127.0.0.1',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
    });

    return response;
  } catch (error) {
    console.error('Unexpected error in callback:', error);
    return NextResponse.redirect(`${baseUrl}/sign-in?error=unexpected`);
  }
}
