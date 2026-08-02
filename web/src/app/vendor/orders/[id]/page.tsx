"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import {
  type OrderDetail,
  cancelOrder,
  getOrder,
  isCancellable,
  isReviewable,
} from "@/lib/orders";
import { createReview } from "@/lib/reviews";

const STATUS_LABEL: Record<OrderDetail["status"], string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function VendorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    if (!accessToken || !id) return;
    let cancelled = false;
    getOrder(accessToken, id)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load the order.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  async function handleCancel() {
    if (!accessToken || !order) return;
    const confirmed = await confirm({
      title: "Cancel this order?",
      message: "This can't be undone — you'll need to place a new order if you change your mind.",
      confirmLabel: "Cancel order",
      cancelLabel: "Keep order",
      tone: "danger",
    });
    if (!confirmed) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelOrder(accessToken, order.id);
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.show({ variant: "success", title: "Order cancelled" });
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Couldn't cancel the order.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleReviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !order) return;
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      await createReview(accessToken, {
        orderId: order.id,
        rating: Number(rating),
        comment: comment.trim() || undefined,
      });
      setReviewSubmitted(true);
      toast.show({
        variant: "success",
        title: "Review submitted",
        message: "Thanks for letting other buyers know how it went.",
      });
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Couldn't submit the review.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
        <p className="text-muted">Loading order…</p>
      </main>
    );
  }

  if (loadError || !order) {
    return (
      <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
        <Link href="/vendor/orders" className="text-sm text-primary-text hover:underline">
          ← Back to orders
        </Link>
        <p role="alert" className="mt-6 text-sm text-danger-700">
          {loadError ?? "Order not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <Link href="/vendor/orders" className="text-sm text-primary-text hover:underline">
        ← Back to orders
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-[650] text-ink">Order</h1>
          <p className="mt-1 font-mono text-xs text-muted">{order.id}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 rounded-md border border-border bg-surface p-5">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Quantity</dt>
          <dd className="text-foreground">{order.quantity} kg</dd>
          <dt className="text-muted">Unit price</dt>
          <dd className="text-foreground">₹{order.unitPrice}</dd>
          <dt className="text-muted">Total</dt>
          <dd className="font-medium text-ink">₹{order.totalAmount}</dd>
          <dt className="text-muted">Delivery method</dt>
          <dd className="text-foreground">
            {order.deliveryMethod === "DELIVERY" ? "Delivery" : "Pickup"}
          </dd>
          <dt className="text-muted">Payment method</dt>
          <dd className="text-foreground">{order.paymentMethod}</dd>
        </dl>

        {isCancellable(order.status) && (
          <div className="mt-5 border-t border-border pt-5">
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => void handleCancel()}
              className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-danger-700 transition-colors hover:bg-background disabled:opacity-60"
            >
              {isCancelling ? "Cancelling…" : "Cancel order"}
            </button>
            {cancelError && (
              <p role="alert" className="mt-2 text-xs text-danger-700">
                {cancelError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-[650] text-ink">Status history</h2>
        {order.statusHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No status changes yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {order.statusHistory.map((entry, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-frosted-blue-500" />
                <span className="text-foreground">
                  {STATUS_LABEL[entry.status]}
                </span>
                <span className="text-muted">
                  {new Date(entry.changedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {isReviewable(order.status) && (
        <div className="mt-8 rounded-md border border-border bg-surface p-5">
          <h2 className="font-[650] text-ink">Leave a review</h2>
          {reviewSubmitted ? (
            <p className="mt-2 text-sm text-success-700">
              Thanks for your review!
            </p>
          ) : (
            <form onSubmit={handleReviewSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="review-rating" className="mb-1 block text-sm font-medium text-foreground">
                  Rating
                </label>
                <select
                  id="review-rating"
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                  className={INPUT_CLASS}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-comment" className="mb-1 block text-sm font-medium text-foreground">
                  Comment (optional)
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  className={INPUT_CLASS}
                />
              </div>
              {reviewError && (
                <p role="alert" className="text-sm text-danger-700">
                  {reviewError}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isSubmittingReview ? "Submitting…" : "Submit review"}
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
