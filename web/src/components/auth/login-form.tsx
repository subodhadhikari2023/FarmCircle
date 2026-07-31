"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FormField } from "./form-field";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      await login(
        String(form.get("email")),
        String(form.get("password")),
      );
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log in failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
      />
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
