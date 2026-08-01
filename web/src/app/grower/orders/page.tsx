"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Order, advanceOrderStatus } from "@/lib/orders-admin";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function GrowerOrdersPage() {
  const { accessToken } = useAuth();

  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  async function handleAdvance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    setIsAdvancing(true);
    try {
      const updated = await advanceOrderStatus(accessToken, orderId.trim());
      setOrder(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't advance the order.",
      );
    } finally {
      setIsAdvancing(false);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Orders</h1>
      <p className="mt-1 text-muted">
        You&apos;ll need the order ID from elsewhere — order lookup isn&apos;t
        available to Growers yet. Advancing moves an order one step forward
        (Placed → Confirmed → Out for delivery/Ready for pickup → Delivered/
        Picked up) based on how it&apos;s already set to be fulfilled.
      </p>

      <form onSubmit={handleAdvance} className="mt-8 flex gap-3">
        <input
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="Order ID"
          required
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={isAdvancing}
          className="shrink-0 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isAdvancing ? "Advancing…" : "Advance status"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {order && (
        <div className="mt-6 rounded-md border border-border bg-surface p-4">
          <p className="font-mono text-xs text-muted">ID: {order.id}</p>
          <p className="mt-2 text-foreground">
            Status: <span className="font-medium">{order.status}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {order.quantity} @ ₹{order.unitPrice} · {order.deliveryMethod}
          </p>
        </div>
      )}
    </main>
  );
}
