const FAQS = [
  {
    question: "Do I need an account to browse?",
    answer:
      "No — browse every listing without signing up. You'll need an account to order, pre-book, or leave a review.",
  },
  {
    question: "How do I pay?",
    answer:
      "Cash on delivery, or pay online — your choice at checkout.",
  },
  {
    question: "What is pre-booking?",
    answer:
      "Reserve a share of a batch before it's harvested. Once it's ready, you'll have 48 hours to pay a 20% advance to confirm your order.",
  },
  {
    question: "Is it pickup or delivery?",
    answer: "Both — pick whichever works for you when you place an order.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl">Questions</h2>
        <div className="mt-8 divide-y divide-border">
          {FAQS.map(({ question, answer }) => (
            <details key={question} className="group py-4">
              <summary className="cursor-pointer list-none font-medium text-foreground marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
