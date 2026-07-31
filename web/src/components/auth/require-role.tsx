"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Role } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";

export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user && user.role !== role) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [status, user, role, router]);

  if (status !== "authenticated" || !user || user.role !== role) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
