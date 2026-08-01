"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  type OrderDetail,
  type OrderStatus,
  disputeOrder,
  getOrder,
} from "@/lib/orders";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

const SELECT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<OrderStatus>("PLACED");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  useEffect(() => {
    if (!accessToken || !id) return;
    let cancelled = false;
    getOrder(accessToken, id)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setTargetStatus(data.status);
        }
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

  async function handleDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !order) return;
    setIsSubmitting(true);
    setDisputeError(null);
    setDisputeSuccess(false);
    try {
      const updated = await disputeOrder(accessToken, order.id, targetStatus);
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev));
      setDisputeSuccess(true);
    } catch (err) {
      setDisputeError(
        err instanceof Error ? err.message : "Couldn't update the order.",
      );
    } finally {
      setIsSubmitting(false);
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
        <Link
          href="/admin/orders"
          className="text-sm text-primary-text hover:underline"
        >
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
      <Link
        href="/admin/orders"
        className="text-sm text-primary-text hover:underline"
      >
        ← Back to orders
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-[650] text-ink">Order</h1>
          <p className="mt-1 font-mono text-xs text-muted">{order.id}</p>
        </div>
        <span className="shrink-0 rounded-full bg-dark-slate-grey-100 px-3 py-1 text-xs font-medium text-dark-slate-grey-800">
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="mt-8 rounded-md border border-border bg-surface p-5">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Buyer</dt>
          <dd className="font-mono text-xs text-foreground">
            {order.buyerId}
          </dd>
          <dt className="text-muted">Listing</dt>
          <dd className="font-mono text-xs text-foreground">
            {order.listingId}
          </dd>
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
      </div>

      <div className="mt-8">
        <h2 className="font-[650] text-ink">Status history</h2>
        {order.statusHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No status changes yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {order.statusHistory.map((entry, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-dark-slate-grey-700" />
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

      <div className="mt-8 rounded-md border border-border bg-surface p-5">
        <h2 className="font-[650] text-ink">Resolve dispute</h2>
        <p className="mt-1 text-sm text-muted">
          Manually override this order&apos;s status — for stuck payments or
          delivery disputes. Setting it to Cancelled releases reserved stock
          back to the listing if it wasn&apos;t cancelled already.
        </p>
        <form
          onSubmit={handleDispute}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-40">
            <label
              htmlFor="dispute-status"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              New status
            </label>
            <select
              id="dispute-status"
              value={targetStatus}
              onChange={(event) =>
                setTargetStatus(event.target.value as OrderStatus)
              }
              className={SELECT_CLASS}
            >
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Apply override"}
          </button>
        </form>
        {disputeSuccess && (
          <p className="mt-3 text-sm text-success-700">Order updated.</p>
        )}
        {disputeError && (
          <p role="alert" className="mt-3 text-sm text-danger-700">
            {disputeError}
          </p>
        )}
      </div>
    </main>
  );
}
