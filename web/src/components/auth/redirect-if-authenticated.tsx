"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";

export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [status, user, router]);

  if (status === "loading" || (status === "authenticated" && user)) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
