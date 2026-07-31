const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer: { name: string };
};

async function getReviews(): Promise<Review[]> {
  try {
    const res = await fetch(`${API_URL}/reviews`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json()) as Review[];
  } catch {
    return [];
  }
}

export async function Reviews() {
  const reviews = (await getReviews())
    .filter((review) => review.comment)
    .slice(0, 3);

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl">What buyers are saying</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {reviews.map((review) => (
            <blockquote
              key={review.id}
              className="rounded-md border border-border bg-surface p-5"
            >
              <div aria-hidden="true">
                <span className="text-ink">
                  {"★".repeat(review.rating)}
                </span>
                <span className="text-granite-300">
                  {"★".repeat(5 - review.rating)}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground">
                &ldquo;{review.comment}&rdquo;
              </p>
              <footer className="mt-3 text-sm font-medium text-muted">
                {review.reviewer.name}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
