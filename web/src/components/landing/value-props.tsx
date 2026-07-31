const VALUE_PROPS = [
  {
    title: "One grower, full trust",
    description:
      "No marketplace of strangers — every listing comes from the same grower, so quality and sourcing are never a guessing game.",
  },
  {
    title: "Traceable from planting",
    description:
      "Tracked listings expose the batch's real milestone timeline, from planting to harvest, not just a product photo.",
  },
  {
    title: "Pre-book before harvest",
    description:
      "Reserve a share of a batch while it's still growing, with a small advance payment — no waiting for stock to appear.",
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-2xl">Why FarmCircle</h2>
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <div
            key={prop.title}
            className="rounded-md border border-border bg-surface p-5 border-t-2 border-t-primary"
          >
            <h3 className="font-[650]">{prop.title}</h3>
            <p className="mt-2 text-sm text-muted">{prop.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
