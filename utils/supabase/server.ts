import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = (useServiceRole: boolean = false) => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookieOptions: {
        name: 'sb-auth-token',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 1 week
      },
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          console.log(`Getting cookie ${name}:`, cookie?.value ? (name.includes('code-verifier') ? 'present' : cookie.value) : 'undefined');
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            console.log(`Setting cookie ${name}:`, name.includes('code-verifier') ? 'present' : value);
            cookieStore.set(name, value, {
              ...options,
              // Always set these cookie options
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              httpOnly: true,
              maxAge: 60 * 60 * 24 * 7 // 1 week
            });
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: any) {
          try {
            console.log(`Removing cookie ${name}`);
            cookieStore.set(name, '', {
              ...options,
              maxAge: -1,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              httpOnly: true
            });
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      }
    }
  );
};
