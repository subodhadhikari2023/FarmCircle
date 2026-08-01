"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  type Review,
  hideReview,
  listHiddenReviews,
  listReviews,
  unhideReview,
} from "@/lib/reviews";

function ReviewRow({
  review,
  actionLabel,
  busyLabel,
  isBusy,
  error,
  onAction,
  actionClassName,
}: {
  review: Review;
  actionLabel: string;
  busyLabel: string;
  isBusy: boolean;
  error?: string;
  onAction: () => void;
  actionClassName: string;
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <div className="flex-1">
        <div aria-hidden="true">
          <span className="text-ink">{"★".repeat(review.rating)}</span>
          <span className="text-granite-300">
            {"★".repeat(5 - review.rating)}
          </span>
        </div>
        {review.comment && (
          <p className="mt-1 text-sm text-foreground">{review.comment}</p>
        )}
        <p className="mt-1 text-sm text-muted">
          {review.reviewer?.name ?? "Unknown reviewer"}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger-700">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={isBusy}
        onClick={onAction}
        className={`rounded-sm border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background disabled:opacity-60 ${actionClassName}`}
      >
        {isBusy ? busyLabel : actionLabel}
      </button>
    </li>
  );
}

export default function AdminReviewsPage() {
  const { accessToken } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [hiddenReviews, setHiddenReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([listReviews(), listHiddenReviews(accessToken)])
      .then(([visible, hidden]) => {
        if (!cancelled) {
          setReviews(visible);
          setHiddenReviews(hidden);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load reviews.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleHide(review: Review) {
    if (!accessToken) return;
    setBusyId(review.id);
    try {
      await hideReview(accessToken, review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setHiddenReviews((prev) => [{ ...review, isHidden: true }, ...prev]);
      setRowError((prev) => ({ ...prev, [review.id]: "" }));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [review.id]:
          err instanceof Error ? err.message : "Couldn't hide the review.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnhide(review: Review) {
    if (!accessToken) return;
    setBusyId(review.id);
    try {
      await unhideReview(accessToken, review.id);
      setHiddenReviews((prev) => prev.filter((r) => r.id !== review.id));
      setReviews((prev) => [{ ...review, isHidden: false }, ...prev]);
      setRowError((prev) => ({ ...prev, [review.id]: "" }));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [review.id]:
          err instanceof Error ? err.message : "Couldn't unhide the review.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
        <p className="text-muted">Loading reviews…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Reviews</h1>
      <p className="mt-1 text-muted">
        Moderate publicly visible reviews. Hiding removes a review from the
        public list; it can be unhidden from the section below at any time.
      </p>

      {loadError && (
        <p role="alert" className="mt-6 text-sm text-danger-700">
          {loadError}
        </p>
      )}

      <div className="mt-10">
        <h2 className="font-[650] text-ink">Visible</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-muted">No visible reviews right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
            {reviews.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                actionLabel="Hide"
                busyLabel="Hiding…"
                isBusy={busyId === review.id}
                error={rowError[review.id]}
                onAction={() => void handleHide(review)}
                actionClassName="text-danger-700"
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-[650] text-ink">Hidden</h2>
        {hiddenReviews.length === 0 ? (
          <p className="mt-2 text-muted">Nothing has been hidden.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
            {hiddenReviews.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                actionLabel="Unhide"
                busyLabel="Unhiding…"
                isBusy={busyId === review.id}
                error={rowError[review.id]}
                onAction={() => void handleUnhide(review)}
                actionClassName="text-foreground"
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
