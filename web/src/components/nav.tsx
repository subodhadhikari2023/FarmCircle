import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="leading-tight">
          <span className="block font-display font-[650] text-lg text-ink">
            FarmCircle
          </span>
          <span className="block text-[0.65rem] font-medium uppercase tracking-widest text-muted">
            From farms to table
          </span>
        </Link>
        <div className="flex gap-6 text-sm">
          <Link
            href="/listings"
            className="font-medium text-primary-text hover:underline"
          >
            Browse
          </Link>
        </div>
      </nav>
    </header>
  );
}
