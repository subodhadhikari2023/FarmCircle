import { ROLE_SHELL } from "@/lib/role-shell";
import type { Role } from "@/lib/auth-context";

// Deliberately doesn't repeat RoleHeader's nav/logout — same links twice on
// one short dashboard page added chrome without adding a function a footer
// wouldn't otherwise serve. The header (incl. its mobile drawer) is the one
// source of truth for role navigation.
export function RoleFooter({ role }: { role: Role }) {
  const config = ROLE_SHELL[role];
  const year = new Date().getFullYear();

  return (
    <footer className={`border-t-2 bg-surface ${config.border}`}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <p className="text-xs text-muted">
          © {year} FarmCircle · {config.label} dashboard
        </p>
      </div>
    </footer>
  );
}
