"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { type Order, listMyOrders } from "@/lib/orders";

const STATUS_LABEL: Record<Order["status"], string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

function PaymentProcessingBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("paid") !== "1") return null;

  return (
    <p className="mt-4 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
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
          <p className="text-muted">Loading orders…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : orders.length === 0 ? (
          <p className="text-muted">
            No orders yet —{" "}
            <Link href="/vendor" className="text-primary-text hover:underline">
              browse the circle
            </Link>{" "}
            to place your first one.
          </p>
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
                  <span className="rounded-full bg-frosted-blue-50 px-2 py-0.5 text-xs font-medium text-frosted-blue-800">
                    {STATUS_LABEL[order.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
