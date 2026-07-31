"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV_LINK_CLASS =
  "font-medium text-foreground transition-colors hover:text-primary-text";

export function NavAuthLinks() {
  const { user, status, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (status === "loading") {
    return (
      <span
        role="status"
        aria-label="Loading"
        className="h-4 w-16 animate-pulse rounded-sm bg-border"
      />
    );
  }

  if (status === "authenticated" && user) {
    async function handleLogout() {
      setIsLoggingOut(true);
      await logout();
    }

    return (
      <>
        <span className="hidden text-muted sm:inline">Hi, {user.name}</span>
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => void handleLogout()}
          className={`${NAV_LINK_CLASS} disabled:opacity-60`}
        >
          Log out
        </button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={NAV_LINK_CLASS}>
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-sm bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sign up
      </Link>
    </>
  );
}
