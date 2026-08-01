"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, type Role } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";
import { ROLE_SHELL } from "@/lib/role-shell";

const NAV_LINK_CLASS =
  "font-medium text-foreground transition-colors hover:text-primary-text";

export function RoleHeader({ role }: { role: Role }) {
  const { user, status, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const config = ROLE_SHELL[role];

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className={`border-b-2 bg-surface ${config.border}`}>
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href={ROLE_HOME[role]} className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-[20px] text-ink"
            aria-hidden="true"
          >
            {config.icon}
          </span>
          <span className="leading-tight">
            <span className="block font-display font-[650] text-lg text-ink">
              FarmCircle
            </span>
            <span
              className={`inline-block rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-widest ${config.badgeBg} ${config.badgeText}`}
            >
              {config.label}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm sm:gap-6">
          {config.links.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
              {link.label}
            </Link>
          ))}

          {status === "loading" && (
            <span
              role="status"
              aria-label="Loading"
              className="h-4 w-16 animate-pulse rounded-sm bg-border"
            />
          )}

          {status === "authenticated" && user && (
            <>
              <span className="hidden text-muted sm:inline">
                Hi, {user.name}
              </span>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                className={`${NAV_LINK_CLASS} disabled:opacity-60`}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
