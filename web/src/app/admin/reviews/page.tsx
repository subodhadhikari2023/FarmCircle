"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Review, hideReview, listReviews } from "@/lib/reviews";

export default function AdminReviewsPage() {
  const { accessToken } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listReviews()
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load reviews.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleHide(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      await hideReview(accessToken, id);
      // No unhide endpoint exists — once hidden, a review drops out of
      // GET /reviews entirely, so just remove it from the list locally.
      setReviews((prev) => prev.filter((review) => review.id !== id));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't hide the review.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Reviews</h1>
      <p className="mt-1 text-muted">
        Publicly visible reviews. Hiding is a permanent takedown — there is
        no way to unhide one afterward.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading reviews…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : reviews.length === 0 ? (
          <p className="text-muted">No visible reviews right now.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="flex flex-wrap items-start gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <div aria-hidden="true">
                    <span className="text-ink">
                      {"★".repeat(review.rating)}
                    </span>
                    <span className="text-granite-300">
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-foreground">
                      {review.comment}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted">
                    {review.reviewer?.name ?? "Unknown reviewer"}
                  </p>
                  {rowError[review.id] && (
                    <p role="alert" className="mt-1 text-xs text-danger-700">
                      {rowError[review.id]}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busyId === review.id}
                  onClick={() => void handleHide(review.id)}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-danger-700 transition-colors hover:bg-background disabled:opacity-60"
                >
                  {busyId === review.id ? "Hiding…" : "Hide"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
