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
  searchParams: { message?: string };
}) {
  const handleSignUp = async (formData: FormData) => {
    const result = await signUpAction(formData);
    if (result.error) {
      toast.error(result.error.message);
    } else if (result.success) {
      toast.success(result.message);
    }
  };

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
      <form onSubmit={handleSignUp} className="space-y-4">
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
