"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, type Role } from "@/lib/auth-context";
import { ROLE_SHELL } from "@/lib/role-shell";

const FOOTER_LINK_CLASS =
  "text-muted transition-colors hover:text-primary-text";

export function RoleFooter({ role }: { role: Role }) {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const config = ROLE_SHELL[role];
  const year = new Date().getFullYear();

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <footer className={`border-t-2 bg-surface ${config.border}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          © {year} FarmCircle · {config.label} dashboard
        </p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          {config.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={FOOTER_LINK_CLASS}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
            className={`${FOOTER_LINK_CLASS} disabled:opacity-60`}
          >
            Log out
          </button>
        </nav>
      </div>
    </footer>
  );
}
