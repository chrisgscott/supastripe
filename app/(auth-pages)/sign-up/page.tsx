"use client";

import { signUpAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import Link from "next/link";
import { toast } from "sonner";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  // Track signup when success message is shown
  if ("message" in searchParams && searchParams.type === "success") {
    // Get email from URL parameters
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) {
      window?.datafast("signup", { email });
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
    window?.datafast("signup", { description: "User signed up for PayKit" });
    
    toast.success('Check your email for the confirmation link');
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
          GitHub
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
