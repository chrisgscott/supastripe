"use client";

import { signUpAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import Link from "next/link";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form action={signUpAction} className="space-y-4">
        {searchParams?.message && (
          <FormMessage type="error" message={{ type: "error", message: searchParams.message }} />
        )}

        <div>
          <Input
            name="email"
            type="email"
            placeholder="Email address"
            required
            className="w-full"
          />
        </div>

        <div>
          <Input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full"
          />
        </div>

        <div>
          <SubmitButton className="w-full">Create account</SubmitButton>
        </div>

        <p className="text-xs text-muted-foreground">
          By clicking "Create account", you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  );
}
