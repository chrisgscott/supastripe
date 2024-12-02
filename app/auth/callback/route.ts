import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user) {
      // Create initial profile
      try {
        const response = await fetch(`${origin}/api/profile`, {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('cookie') || '',
          },
        });

        if (!response.ok) {
          console.error('Failed to create initial profile:', await response.text());
        }
      } catch (err) {
        console.error('Error creating initial profile:', err);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/dashboard`);
}
