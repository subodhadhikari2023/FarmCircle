"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { type Order, listMyOrders } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminOrdersPage() {
  const { accessToken } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    // GET /orders returns every order when the caller is Admin
    // (OrdersService.findAllForUser) — no filtering needed client-side.
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

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        All orders
      </h1>
      <p className="mt-1 text-muted">
        Every order across every buyer and listing. Open one to resolve a
        stuck or disputed state.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long">No orders have been placed yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-background"
                >
                  <div className="flex-1">
                    <p className="font-mono text-xs text-muted">{order.id}</p>
                    <p className="mt-1 text-sm text-foreground">
                      {order.quantity} @ ₹{order.unitPrice} · ₹
                      {order.totalAmount}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
