"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { setSessionFromToken } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("accessToken");

    if (!token) {
      router.replace("/login");
      return;
    }

    setSessionFromToken(token)
      .then((me) => router.replace(me ? ROLE_HOME[me.role] : "/login"))
      .catch(() => router.replace("/login"));
  }, [router, setSessionFromToken]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-muted">Signing you in…</p>
    </main>
  );
}
