"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV_LINK_CLASS =
  "font-medium text-foreground transition-colors hover:text-primary-text";

export function NavAuthLinks() {
  const { user, status, logout } = useAuth();

  if (status === "loading") {
    return <span className="h-4 w-16 animate-pulse rounded-sm bg-border" />;
  }

  if (status === "authenticated" && user) {
    return (
      <>
        <span className="hidden text-muted sm:inline">Hi, {user.name}</span>
        <button
          type="button"
          onClick={() => void logout()}
          className={NAV_LINK_CLASS}
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
