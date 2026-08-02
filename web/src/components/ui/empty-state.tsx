export function EmptyState({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <p className="text-muted">{children}</p>
    </div>
  );
}
