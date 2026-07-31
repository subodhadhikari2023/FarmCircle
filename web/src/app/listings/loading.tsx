export default function ListingsLoading() {
  return (
    <main className="mx-auto flex-1 max-w-5xl px-6 py-16">
      <div className="h-9 w-64 animate-pulse rounded-sm bg-border" />
      <div className="mt-2 h-5 w-96 max-w-full animate-pulse rounded-sm bg-border" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-md border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
