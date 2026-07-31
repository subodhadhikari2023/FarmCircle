import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { RedirectIfAuthenticated } from "@/components/auth/redirect-if-authenticated";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <RedirectIfAuthenticated>
      <AuthCard title="Log in" subtitle="Welcome back to FarmCircle.">
        {error === "google_auth_failed" && (
          <p
            role="alert"
            className="mb-4 rounded-sm border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700"
          >
            Google sign-in didn&apos;t go through. Please try again.
          </p>
        )}

        <GoogleButton label="Continue with Google" role="CUSTOMER" />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary-text hover:underline">
            Sign up
          </Link>
        </p>
      </AuthCard>
    </RedirectIfAuthenticated>
  );
}
