import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { RedirectIfAuthenticated } from "@/components/auth/redirect-if-authenticated";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <RedirectIfAuthenticated>
      <AuthCard title="Sign up" subtitle="Join FarmCircle as a Vendor or Customer.">
        <SignupForm />
      </AuthCard>
    </RedirectIfAuthenticated>
  );
}
