"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const signUpAction = async (email: string, password: string) => {
  const supabase = createClient();
  const origin = headers().get("origin");

  if (!email || !password) {
    return { error: { message: "Email and password are required" } };
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (signUpError) {
    return { error: { message: signUpError.message } };
  }

  return { error: null };
};

export const signInAction = async (email: string, password: string) => {
  const supabase = createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: { message: signInError.message } };
  }

  return { error: null };
};

export const signInWithGoogleAction = async () => {
  const supabase = createClient();
  const baseUrl = 'http://127.0.0.1:3000';
  
  console.log('Initiating Google OAuth flow');
  console.log('Google OAuth redirect URL:', `${baseUrl}/auth/callback`);

  // Log current cookies before starting OAuth
  const cookieStore = cookies();
  console.log('Cookies before OAuth:', cookieStore.getAll().map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') ? 'present' : c.value
  })));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      skipBrowserRedirect: true,  // Let us handle the redirect
    },
  });

  if (error) {
    console.error('Google OAuth error:', {
      name: error.name,
      message: error.message,
      status: error.status
    });
    return { error };
  }

  // Log cookies after OAuth initialization
  console.log('Cookies after OAuth init:', cookieStore.getAll().map(c => ({ 
    name: c.name, 
    value: c.name.includes('code-verifier') ? 'present' : c.value
  })));

  // Ensure all cookies are properly set before redirecting
  if (data.url) {
    return { url: data.url };
  } else {
    console.error('No URL returned from OAuth initialization');
    return { error: { message: 'Failed to initialize OAuth flow' } };
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = createClient();
  const origin = headers().get("origin");

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return encodedRedirect("error", "/forgot-password", error.message);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for the password reset link"
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const password = formData.get("password")?.toString();
  const passwordConfirm = formData.get("passwordConfirm")?.toString();
  const supabase = createClient();

  if (!password) {
    return encodedRedirect("error", "/reset-password", "Password is required");
  }

  if (password !== passwordConfirm) {
    return encodedRedirect(
      "error",
      "/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return encodedRedirect("error", "/reset-password", error.message);
  }

  return encodedRedirect(
    "success",
    "/sign-in",
    "Your password has been reset"
  );
};

export const signOutAction = async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect("/");
};
