"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { type Order, listMyOrders } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

function PaymentProcessingBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("paid") !== "1") return null;

  return (
    <p className="mt-4 flex items-center gap-2 rounded-md border border-success-100 bg-success-100 px-4 py-3 text-sm text-success-800">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        check_circle
      </span>
      Payment received — your order will appear here shortly.
    </p>
  );
}

export default function VendorOrdersPage() {
  const { accessToken } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
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
      <h1 className="font-display text-2xl font-[650] text-ink">My orders</h1>
      <p className="mt-1 text-muted">
        Every order you&apos;ve placed, with its current fulfillment status.
      </p>

      <Suspense fallback={null}>
        <PaymentProcessingBanner />
      </Suspense>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long">
            No orders yet —{" "}
            <Link href="/vendor" className="text-primary-text hover:underline">
              browse the circle
            </Link>{" "}
            to place your first one.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/vendor/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-background"
                >
                  <div className="flex-1">
                    <p className="font-mono text-xs text-muted">{order.id}</p>
                    <p className="mt-1 text-sm text-foreground">
                      {order.quantity} kg @ ₹{order.unitPrice} ·{" "}
                      {order.deliveryMethod === "DELIVERY"
                        ? "Delivery"
                        : "Pickup"}
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
