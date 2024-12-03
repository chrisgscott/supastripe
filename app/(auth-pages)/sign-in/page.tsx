"use client";

import { signInAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import Link from "next/link";
import { toast } from "sonner";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle={
        <>
          Don't have an account?{' '}
          <Link href="/sign-up" className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form action={signInAction} className="space-y-4">
        {searchParams?.message && (
          <FormMessage type="error">{searchParams.message}</FormMessage>
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

        <div className="flex items-center justify-between">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div>
          <SubmitButton className="w-full">Sign in</SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
}
