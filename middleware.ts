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
      domain: '127.0.0.1',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
  });
};

export async function middleware(request: NextRequest) {
  try {
    console.log('Cookies in middleware:', request.cookies);

    // Create response to modify
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

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
        cookies: {
          get(name: string) {
            const cookie = request.cookies.get(name);
            console.log('Getting cookie', name + ':', cookie?.value);
            return cookie?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            console.log('Setting cookie', name + ':', value ? 'present' : 'removed');
            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              domain: '127.0.0.1',
              httpOnly: true,
              maxAge: 60 * 60 * 24 * 7 // 1 week
            });
          },
          remove(name: string, options: CookieOptions) {
            console.log('Removing cookie', name);
            request.cookies.delete(name);
            response.cookies.set(name, '', {
              maxAge: -1,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              domain: '127.0.0.1',
              httpOnly: true
            });
          },
        },
      }
    );

    // Allow unauthenticated access to payment pages
    if (request.nextUrl.pathname.startsWith('/pay/')) {
      return NextResponse.next();
    }

    // Allow direct access to auth pages
    if (request.nextUrl.pathname.startsWith('/sign-in') || 
        request.nextUrl.pathname.startsWith('/sign-up')) {
      return NextResponse.next();
    }

    // Handle auth callback
    if (request.nextUrl.pathname === '/auth/callback') {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (user) {
          const redirectUrl = new URL('/dashboard', request.url);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          copyCookiesToResponse(request.cookies, redirectResponse);
          return redirectResponse;
        }
      } catch (error) {
        console.error('Auth error:', error);
        const redirectUrl = new URL('/sign-in?error=auth_error', request.url);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        copyCookiesToResponse(request.cookies, redirectResponse);
        return redirectResponse;
      }
    }

    // Check authentication for other routes
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id || 'none');

    // Handle root path
    if (request.nextUrl.pathname === '/') {
      const redirectUrl = new URL(user ? '/dashboard' : '/sign-in', request.url);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyCookiesToResponse(request.cookies, redirectResponse);
      return redirectResponse;
    }

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      const redirectUrl = new URL('/sign-in', request.url);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyCookiesToResponse(request.cookies, redirectResponse);
      return redirectResponse;
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
