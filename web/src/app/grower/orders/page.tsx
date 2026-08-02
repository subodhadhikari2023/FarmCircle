"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type Order,
  advanceOrderStatus,
  hasNextStatus,
  listMyOrders,
} from "@/lib/orders-admin";

export default function GrowerOrdersPage() {
  const { accessToken } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listMyOrders(accessToken)
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load orders.",
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

  async function handleAdvance(orderId: string) {
    if (!accessToken) return;
    setBusyId(orderId);
    try {
      const updated = await advanceOrderStatus(accessToken, orderId);
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updated : order)),
      );
      setRowError((prev) => ({ ...prev, [orderId]: "" }));
      toast.show({
        variant: "success",
        title: "Order status updated",
        message: `Now ${updated.status.replace(/_/g, " ").toLowerCase()}.`,
      });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [orderId]:
          err instanceof Error ? err.message : "Couldn't advance the order.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Orders</h1>
      <p className="mt-1 text-muted">
        Orders placed against your listings. Advancing moves an order one
        step forward (Placed → Confirmed → Out for delivery/Ready for pickup
        → Delivered/Picked up) based on how it&apos;s set to be fulfilled.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long">
            No orders yet — they&apos;ll show up here once a buyer orders
            from one of your listings.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-mono text-xs text-muted">{order.id}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {order.quantity} @ ₹{order.unitPrice} ·{" "}
                    {order.deliveryMethod === "DELIVERY"
                      ? "Delivery"
                      : "Pickup"}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
                <button
                  type="button"
                  disabled={busyId === order.id || !hasNextStatus(order.status)}
                  onClick={() => void handleAdvance(order.id)}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:opacity-60"
                >
                  {busyId === order.id ? "Advancing…" : "Advance status"}
                </button>
                {rowError[order.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[order.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
