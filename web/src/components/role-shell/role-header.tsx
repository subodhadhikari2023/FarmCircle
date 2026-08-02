"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, type Role } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";
import { ROLE_SHELL } from "@/lib/role-shell";

const NAV_LINK_CLASS =
  "flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary-text";

export function RoleHeader({ role }: { role: Role }) {
  const { user, status, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <header className={`relative border-b-2 bg-surface ${config.border}`}>
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

        {/* Desktop: inline links. Below md, the row would overflow the
            viewport (Grower/Vendor both carry 5 links + greeting + logout),
            so it collapses into the drawer button instead of wrapping. */}
        <div className="hidden items-center gap-6 text-sm md:flex">
          {config.links.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {link.icon}
              </span>
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
              <span className="text-muted">Hi, {user.name}</span>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                className={`${NAV_LINK_CLASS} disabled:opacity-60`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  logout
                </span>
                Log out
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="role-nav-drawer"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="flex items-center justify-center rounded-sm p-1.5 text-ink transition-colors hover:bg-background md:hidden"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            {isMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </nav>

      {isMenuOpen && (
        <div
          id="role-nav-drawer"
          className="absolute inset-x-0 top-full z-40 border-b-2 border-border bg-surface px-6 py-4 shadow-lg md:hidden"
          style={{
            boxShadow:
              "0 16px 32px -12px color-mix(in srgb, var(--color-dark-slate-grey-900) 22%, transparent)",
          }}
        >
          <ul className="flex flex-col gap-1">
            {config.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 rounded-sm px-2 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
                >
                  <span className="material-symbols-outlined text-[20px] text-muted" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {status === "authenticated" && user && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted">Hi, {user.name}</span>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => {
                  setIsMenuOpen(false);
                  void handleLogout();
                }}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  logout
                </span>
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
