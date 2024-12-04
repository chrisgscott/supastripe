"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from 'next/cache'

export const signUpAction = async (formData: FormData) => {
  console.log('Starting sign-up process for email:', formData.get("email"));
  cookies();
  const supabase = createClient();
  const origin = headers().get("origin");
  console.log('Origin URL:', origin);

  if (!formData.get("email") || !formData.get("password")) {
    console.warn('Sign-up validation failed: Missing email or password');
    return { error: { message: "Email and password are required" } };
  }

  console.log('Attempting sign-up with Supabase...');
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
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

  revalidatePath('/', 'layout')
  redirect('/auth/confirm-email')
  return { error: null };
};

export const signInAction = async (formData: FormData) => {
  console.log('Starting sign-in process for email:', formData.get("email"));
  cookies();
  const supabase = createClient();

  console.log('Attempting sign-in with Supabase...');
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
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

  revalidatePath('/', 'layout')
  redirect('/dashboard')
  return { error: null };
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  cookies();
  const origin = headers().get("origin");
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return { success: true }
};

export const resetPasswordAction = async (formData: FormData) => {
  const password = formData.get("password") as string;
  cookies();
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: { message: error.message } };
  }

  revalidatePath('/', 'layout')
  redirect('/sign-in?message=Password updated successfully')
  return { error: null };
};

export const signOutAction = async () => {
  cookies();
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout')
  return redirect("/sign-in");
};
