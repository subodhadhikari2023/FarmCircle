import Link from "next/link";
import { FooterAuthLinks } from "@/components/footer-auth-links";

const FOOTER_LINK_CLASS =
  "text-muted transition-colors hover:text-primary-text";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="block font-display font-[650] text-lg text-ink">
              FarmCircle
            </span>
            <p className="mt-2 max-w-xs text-sm text-muted">
              From farms to table — a single-grower produce marketplace.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-8 gap-y-2 text-sm sm:justify-end"
          >
            <Link href="/listings" className={FOOTER_LINK_CLASS}>
              Browse
            </Link>
            <Link href="/#how-it-works" className={FOOTER_LINK_CLASS}>
              How it works
            </Link>
            <FooterAuthLinks />
          </nav>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted">
            © {year} FarmCircle. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
