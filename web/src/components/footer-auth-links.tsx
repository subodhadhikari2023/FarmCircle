"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const FOOTER_LINK_CLASS =
  "text-muted transition-colors hover:text-primary-text";

export function FooterAuthLinks() {
  const { status, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (status === "loading") {
    return (
      <span
        role="status"
        aria-label="Loading"
        className="h-4 w-24 animate-pulse rounded-sm bg-border"
      />
    );
  }

  if (status === "authenticated") {
    async function handleLogout() {
      setIsLoggingOut(true);
      try {
        await logout();
      } finally {
        setIsLoggingOut(false);
      }
    }

    return (
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={() => void handleLogout()}
        className={`${FOOTER_LINK_CLASS} disabled:opacity-60`}
      >
        Log out
      </button>
    );
  }

  return (
    <>
      <Link href="/login" className={FOOTER_LINK_CLASS}>
        Log in
      </Link>
      <Link href="/signup" className={FOOTER_LINK_CLASS}>
        Sign up
      </Link>
    </>
  );
}
