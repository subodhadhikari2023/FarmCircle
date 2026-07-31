import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { GoogleButton } from "@/components/auth/google-button";

export default function LoginPage() {
  return (
    <AuthCard title="Log in" subtitle="Welcome back to FarmCircle.">
      <GoogleButton label="Continue with Google" role="CUSTOMER" />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form className="flex flex-col gap-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
        <button
          type="submit"
          className="mt-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Log in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary-text hover:underline">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
