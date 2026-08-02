// Layout-matching skeleton for the `divide-y ... rounded-md border ...`
// list pattern used across most authenticated list pages — previously only
// the public listings route had this treatment; everywhere else just
// swapped in a line of plain text once data arrived.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="divide-y divide-border rounded-md border border-border bg-surface"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="h-3.5 w-32 animate-pulse rounded-sm bg-border" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded-sm bg-border" />
          </div>
          <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-border" />
        </div>
      ))}
    </div>
  );
}
