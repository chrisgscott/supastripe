"use client";

import { signUpAction, signInWithGoogleAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";

declare global {
  interface Window {
    datafast?: (event: string, data?: any) => void;
  }
}

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { message: string; type?: string };
}) {
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Session state in sign-up:', { 
        hasSession: !!session,
        error: error?.message
      });
    };
    checkSession();
  }, []);

  // Track signup when success message is shown
  if ("message" in searchParams && searchParams.type === "success") {
    // Get email from URL parameters
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) {
      window.datafast?.("signup", { email });
    }
    return (
      <AuthLayout>
        <div className="flex items-center justify-center">
          <FormMessage message={searchParams} />
        </div>
      </AuthLayout>
    );
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signUpAction(email, password);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Track signup
    window.datafast?.("signup", { description: "User signed up for PayKit" });
    
    toast.success('Check your email for the confirmation link');
  };

  const handleGoogleSignIn = async () => {
    console.log('Starting Google sign-in...');
    const { error, url } = await signInWithGoogleAction();
    
    if (error) {
      console.error('Google sign-in error:', error);
      toast.error(error.message);
      return;
    }

    if (url) {
      console.log('Redirecting to Google OAuth URL...');
      window.location.href = url;
    }
  };

  return (
    <AuthLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email below to create your account
        </p>
      </div>

      <form className="mt-6" onSubmit={handleSignUp}>
        <div className="space-y-4">
          <Input
            name="email"
            type="email"
            placeholder="name@example.com"
            required
          />
          <Input
            name="password"
            type="password"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>

        <SubmitButton className="mt-4 w-full bg-[#0369a1] text-white hover:bg-[#0369a1]/90" type="submit" pendingText="Signing up...">
          Sign up with email
        </SubmitButton>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">OR CONTINUE WITH</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-[#0369a1] hover:underline">
            Sign in
          </Link>
        </p>
        
        <FormMessage message={searchParams} />
      </form>
    </AuthLayout>
  );
}
