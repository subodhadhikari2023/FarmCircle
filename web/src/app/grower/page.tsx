"use client";

import { useAuth } from "@/lib/auth-context";

export default function GrowerDashboardPage() {
  const { user } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        Grower dashboard
      </h1>
      <p className="text-muted">Hello, {user?.email}</p>
    </main>
  );
}
