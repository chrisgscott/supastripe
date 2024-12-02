import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CookieOptions } from '@supabase/ssr'
import { RequestCookies } from 'next/dist/server/web/spec-extension/cookies'

// Helper function to copy cookies to response
const copyCookiesToResponse = (cookies: RequestCookies, response: NextResponse) => {
  cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
  });
};

export async function middleware(request: NextRequest) {
  console.log('=== Middleware Started ===');
  console.log('Request URL:', request.nextUrl.pathname);
  
  try {
    // Create response to modify
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Log cookies safely
    console.log('Request cookies:', request.cookies.getAll().map(c => ({
      name: c.name,
      value: c.name.includes('code-verifier') || c.name.includes('sb-') ? '[REDACTED]' : c.value
    })));

    // Create Supabase client with consistent cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          name: 'sb-auth-token',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7 // 1 week
        },
        cookies: {
          get(name: string) {
            const value = request.cookies.get(name)?.value;
            console.log(`Getting cookie ${name}: ${value ? 'present' : 'undefined'}`);
            return value;
          },
          set(name: string, value: string, options: CookieOptions) {
            console.log(`Setting cookie ${name}:`, name.includes('code-verifier') ? 'present' : value);
            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              httpOnly: true,
              maxAge: 60 * 60 * 24 * 7 // 1 week
            });
          },
          remove(name: string, options: CookieOptions) {
            console.log(`Removing cookie ${name}`);
            request.cookies.delete(name);
            response.cookies.set(name, '', {
              ...options,
              maxAge: -1,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              httpOnly: true
            });
          },
        },
      }
    );

    // Public routes that don't require authentication
    const publicRoutes = [
      '/sign-in',
      '/sign-up',
      '/auth/callback',
      '/pay',
      '/forgot-password',
      '/reset-password'
    ];

    // Routes that don't require onboarding
    const noOnboardingRoutes = [
      ...publicRoutes,
      '/onboarding'
    ];

    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    );

    const isNoOnboardingRoute = noOnboardingRoutes.some(route =>
      request.nextUrl.pathname.startsWith(route)
    );

    console.log('Route access check:', {
      path: request.nextUrl.pathname,
      isPublicRoute,
      publicRoutes
    });

    if (isPublicRoute) {
      console.log('Allowing access to public route');
      return response;
    }

    // Get the user's session
    console.log('Checking session state...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', {
        code: sessionError.status,
        message: sessionError.message,
        details: sessionError.stack
      });
      return redirectToSignIn(request.url);
    }

    // Log full session state for debugging
    console.log('Session state:', {
      hasSession: !!session,
      userId: session?.user?.id,
      expiresAt: session?.expires_at,
      accessToken: session?.access_token ? 'present' : 'missing',
      refreshToken: session?.refresh_token ? 'present' : 'missing'
    });

    // Handle root path
    if (request.nextUrl.pathname === '/') {
      const destination = session ? '/dashboard' : '/sign-in';
      console.log(`Redirecting root path to: ${destination}`);
      return redirectToPath(destination, request.url);
    }

    // Protect authenticated routes
    if (!session && !isPublicRoute) {
      console.log('Access denied: No valid session for protected route');
      return redirectToSignIn(request.url);
    }

    // Check if user needs onboarding
    if (session && !isNoOnboardingRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_onboarded) {
        console.log('User not onboarded, redirecting to onboarding');
        return redirectToPath('/onboarding', request.url);
      }
    }

    console.log('=== Middleware Completed Successfully ===');
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return redirectToSignIn(request.url);
  }
}

// Helper functions
function redirectToSignIn(requestUrl: string) {
  console.log('Redirecting to sign-in page');
  const redirectUrl = new URL('/sign-in', requestUrl);
  return NextResponse.redirect(redirectUrl);
}

function redirectToPath(path: string, requestUrl: string) {
  console.log(`Redirecting to path: ${path}`);
  const redirectUrl = new URL(path, requestUrl);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
