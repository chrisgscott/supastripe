import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: any) {
            request.cookies.delete(name);
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set(name, '', { ...options, maxAge: 0 });
          },
        },
      },
    );

    // Handle OAuth callback
    if (request.nextUrl.pathname === '/auth/callback') {
      const code = request.nextUrl.searchParams.get('code');
      if (code) {
        console.log('Exchanging code for session...');
        try {
          const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging code:', error);
          } else {
            console.log('Session exchange successful:', session ? 'Session present' : 'No session');
            if (session) {
              return response;
            }
          }
        } catch (error) {
          console.error('Error during session exchange:', error);
        }
      }
    }

    // This will refresh session if expired
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting user:', userError);
    } else {
      console.log('User state:', user ? 'Authenticated' : 'Not authenticated');
    }

    // Check if user has completed onboarding
    let isOnboarded = false;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id, is_onboarded')
        .eq('id', user.id)
        .single();
      
      isOnboarded = profile?.is_onboarded || false;
    }

    // Redirect authenticated users away from auth pages
    if ((request.nextUrl.pathname.startsWith("/sign-in") || 
         request.nextUrl.pathname.startsWith("/sign-up")) && 
        user) {
      return NextResponse.redirect(new URL(isOnboarded ? "/dashboard" : "/onboarding", request.url));
    }

    // protected routes
    if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Redirect non-onboarded users to onboarding
    if (request.nextUrl.pathname.startsWith("/dashboard") && user && !isOnboarded) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Redirect onboarded users away from onboarding
    if (request.nextUrl.pathname.startsWith("/onboarding") && user && isOnboarded) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (request.nextUrl.pathname === "/" && user) {
      return NextResponse.redirect(new URL(isOnboarded ? "/dashboard" : "/onboarding", request.url));
    }

    return response;
  } catch (e) {
    console.error('Middleware error:', e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
