export default function ListingDetailLoading() {
  return (
    <main
      role="status"
      aria-label="Loading listing"
      className="mx-auto flex-1 max-w-3xl px-6 py-16"
    >
      <div aria-hidden="true" className="h-5 w-32 animate-pulse rounded-sm bg-border" />
      <div aria-hidden="true" className="mt-6 h-9 w-48 animate-pulse rounded-sm bg-border" />
      <div aria-hidden="true" className="mt-2 h-5 w-32 animate-pulse rounded-sm bg-border" />
      <div aria-hidden="true" className="mt-8 h-8 w-40 animate-pulse rounded-sm bg-border" />
    </main>
  );
}
