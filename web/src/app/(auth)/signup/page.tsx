import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <AuthCard title="Sign up" subtitle="Join FarmCircle as a Vendor or Customer.">
      <SignupForm />
    </AuthCard>
  );
}
