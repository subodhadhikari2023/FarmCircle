"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";
import { FormField } from "./form-field";
import { GoogleButton } from "./google-button";

type Role = "CUSTOMER" | "VENDOR";

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Vendor",
};

const ROLE_CARD_CLASS =
  "block cursor-pointer rounded-md border p-3 text-sm transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-focus-ring)]";

export function SignupForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const me = await register({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        role,
      });
      router.push(ROLE_HOME[me.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 block p-0 text-sm font-medium text-foreground">
          I want to
        </legend>
        <p className="mb-2 text-xs text-muted">
          Applies to whichever way you sign up below.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              type="radio"
              name="role"
              id="role-customer"
              value="CUSTOMER"
              checked={role === "CUSTOMER"}
              onChange={() => setRole("CUSTOMER")}
              className="peer sr-only"
            />
            <label
              htmlFor="role-customer"
              className={`${ROLE_CARD_CLASS} ${
                role === "CUSTOMER"
                  ? "border-lavender-grey-500 bg-lavender-grey-50"
                  : "border-border"
              }`}
            >
              <span className="font-medium">Buy produce</span>
              <span className="block text-xs text-muted">Customer</span>
            </label>
          </div>
          <div>
            <input
              type="radio"
              name="role"
              id="role-vendor"
              value="VENDOR"
              checked={role === "VENDOR"}
              onChange={() => setRole("VENDOR")}
              className="peer sr-only"
            />
            <label
              htmlFor="role-vendor"
              className={`${ROLE_CARD_CLASS} ${
                role === "VENDOR"
                  ? "border-frosted-blue-500 bg-frosted-blue-50"
                  : "border-border"
              }`}
            >
              <span className="font-medium">Resell produce</span>
              <span className="block text-xs text-muted">Vendor</span>
            </label>
          </div>
        </div>
      </fieldset>

      <GoogleButton
        label={`Continue with Google as a ${ROLE_LABEL[role]}`}
        role={role}
      />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <FormField id="name" label="Full name" autoComplete="name" required />
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
        autoComplete="new-password"
        required
        minLength={8}
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
        {isSubmitting ? "Signing up…" : `Sign up as a ${ROLE_LABEL[role]}`}
      </button>

      <p className="mt-2 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-text hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
