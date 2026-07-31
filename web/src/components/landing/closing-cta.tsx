import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-2xl">Ready to browse the circle?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          See what&apos;s in season right now, straight from the grower.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/listings"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse the circle
          </Link>
          <Link
            href="/signup"
            className="rounded-sm border border-secondary px-6 py-3 text-sm font-medium text-secondary transition-colors hover:bg-surface"
          >
            Sign up
          </Link>
        </div>
      </div>
    </section>
  );
}
