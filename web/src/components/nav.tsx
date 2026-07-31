import Link from "next/link";
import { NavAuthLinks } from "@/components/nav-auth-links";

const NAV_LINK_CLASS =
  "font-medium text-foreground transition-colors hover:text-primary-text";

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="leading-tight">
          <span className="block font-display font-[650] text-lg text-ink">
            FarmCircle
          </span>
          <span className="hidden text-[0.65rem] font-medium uppercase tracking-widest text-muted sm:block">
            From farms to table
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm sm:gap-6">
          <Link href="/listings" className={NAV_LINK_CLASS}>
            Browse
          </Link>
          <NavAuthLinks />
        </div>
      </nav>
    </header>
  );
}
