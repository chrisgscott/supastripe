"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const signUpAction = async (email: string, password: string) => {
  console.log('Starting sign-up process for email:', email);
  const supabase = createClient();
  const origin = headers().get("origin");
  console.log('Origin URL:', origin);

  if (!email || !password) {
    console.warn('Sign-up validation failed: Missing email or password');
    return { error: { message: "Email and password are required" } };
  }

  console.log('Attempting sign-up with Supabase...');
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        email_confirmed: false,
      }
    },
  });

  if (signUpError) {
    console.error('Sign-up error:', {
      code: signUpError.status,
      message: signUpError.message,
      details: signUpError.stack
    });
    return { error: { message: signUpError.message } };
  }

  if (data?.user) {
    console.log('Sign-up successful:', {
      userId: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.email_confirmed_at,
      createdAt: data.user.created_at,
      lastSignIn: data.user.last_sign_in_at
    });

    // Create profile record for the new user using service role client
    const serviceRoleClient = createClient(true);
    const { error: profileError } = await serviceRoleClient
      .from('profiles')
      .insert([
        { 
          id: data.user.id,
          is_onboarded: false
        }
      ]);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return { error: { message: 'Failed to create user profile' } };
    }
  }

  return { error: null };
};

export const signInAction = async (email: string, password: string) => {
  console.log('Starting sign-in process for email:', email);
  const supabase = createClient();

  console.log('Attempting sign-in with Supabase...');
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error('Sign-in error:', {
      code: signInError.status,
      message: signInError.message,
      details: signInError.stack
    });
    return { error: { message: signInError.message } };
  }

  if (data?.user) {
    console.log('Sign-in successful:', {
      userId: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.email_confirmed_at,
      lastSignIn: data.user.last_sign_in_at
    });
    console.log('Session details:', {
      expiresAt: data.session?.expires_at,
      providerToken: data.session?.provider_token ? 'present' : 'none'
    });
  }

  return { error: null };
};

export const signInWithGoogleAction = async () => {
  console.log('Starting Google OAuth sign-in process');
  const supabase = createClient();
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_SITE_URL 
    : 'http://127.0.0.1:3000';
  
  console.log('OAuth configuration:', {
    baseUrl,
    redirectUrl: `${baseUrl}/auth/callback`,
    provider: 'google'
  });

  // Log current cookies
  const cookieStore = cookies();
  console.log('Pre-OAuth cookies:', cookieStore.getAll().map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') ? '[REDACTED]' : c.value
  })));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error('Google OAuth error:', {
      code: error.status,
      message: error.message,
      details: error.stack
    });
    return { error };
  }

  // Log post-OAuth cookies
  console.log('Post-OAuth cookies:', cookieStore.getAll().map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') ? '[REDACTED]' : c.value
  })));

  if (data?.url) {
    console.log('OAuth URL generated:', data.url.split('?')[0], '(query params redacted)');
    return { url: data.url };
  } else {
    console.error('No URL returned from OAuth initialization');
    return { error: { message: 'Failed to initialize OAuth flow' } };
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  console.log('Starting forgot password process');
  const email = formData.get("email")?.toString();
  const supabase = createClient();
  const origin = headers().get("origin");

  if (!email) {
    console.warn('Forgot password validation failed: Missing email');
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  console.log('Attempting to send password reset email...');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error('Forgot password error:', {
      code: error.status,
      message: error.message,
      details: error.stack
    });
    return encodedRedirect("error", "/forgot-password", error.message);
  }

  console.log('Password reset email sent successfully');
  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for the password reset link"
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  console.log('Starting reset password process');
  const password = formData.get("password")?.toString();
  const passwordConfirm = formData.get("passwordConfirm")?.toString();
  const supabase = createClient();

  if (!password) {
    console.warn('Reset password validation failed: Missing password');
    return encodedRedirect("error", "/reset-password", "Password is required");
  }

  if (password !== passwordConfirm) {
    console.warn('Reset password validation failed: Passwords do not match');
    return encodedRedirect(
      "error",
      "/reset-password",
      "Passwords do not match"
    );
  }

  console.log('Attempting to reset password...');
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    console.error('Reset password error:', {
      code: error.status,
      message: error.message,
      details: error.stack
    });
    return encodedRedirect("error", "/reset-password", error.message);
  }

  console.log('Password reset successfully');
  return encodedRedirect(
    "success",
    "/sign-in",
    "Your password has been reset"
  );
};

export const signOutAction = async () => {
  console.log('Starting sign-out process');
  const supabase = createClient();
  await supabase.auth.signOut();
  console.log('Sign-out successful');
  return redirect("/");
};
