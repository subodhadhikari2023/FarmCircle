export function MeetTheGrower() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
          <h2 className="text-2xl">Meet the grower</h2>
          <div className="flex flex-col gap-4 text-sm text-foreground">
            <p>
              Every listing on FarmCircle comes from the same working farm —
              not a network of resellers. When a batch is tracked, you can
              follow it from planting through harvest before it ever reaches
              a listing.
            </p>
            <p>
              That single-source model is why pricing, quantities, and
              timelines stay accurate: there&apos;s no chain of
              middlemen re-pricing or repackaging along the way, just the
              grower and the record of what was actually grown.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
