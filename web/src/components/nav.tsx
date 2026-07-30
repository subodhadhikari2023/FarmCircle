import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold text-lg">
          FarmCircle
        </Link>
        <div className="flex gap-6 text-sm">
          <Link href="/listings">Browse</Link>
        </div>
      </nav>
    </header>
  );
}
