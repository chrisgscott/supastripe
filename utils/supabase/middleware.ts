import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
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
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { data: { user } } = await supabase.auth.getUser();

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
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
