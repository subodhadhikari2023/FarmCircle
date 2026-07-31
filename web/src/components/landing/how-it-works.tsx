const STEPS = [
  {
    step: "1",
    title: "A batch gets listed",
    description:
      "The grower posts a batch of crops — either tracked from planting with a milestone timeline, or listed directly from existing stock.",
  },
  {
    step: "2",
    title: "You pre-book or order",
    description:
      "Pre-book a share of a growing batch with a small advance, or order directly once it's ready — online or cash on delivery.",
  },
  {
    step: "3",
    title: "Pickup, delivery, and a review",
    description:
      "Get your produce, then leave a review once the order is fulfilled — reviews are tied to the grower, not a single listing.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-[650]">How it works</h2>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ step, title, description }) => (
            <div key={step}>
              <span className="font-mono text-sm font-medium text-primary-text">
                {step.padStart(2, "0")}
              </span>
              <h3 className="mt-1 font-[650]">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
