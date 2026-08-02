"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type PreBooking, listMyPreBookings } from "@/lib/prebookings";
import { PreBookingStatusBadge } from "@/components/ui/status-badge";
import { PaymentDeadline } from "@/components/ui/payment-deadline";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminPreBookingsPage() {
  const { accessToken } = useAuth();

  const [preBookings, setPreBookings] = useState<PreBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    // GET /prebookings returns every pre-booking when the caller is Admin
    // (PreBookingsService.findAllForUser) — no filtering needed client-side.
    listMyPreBookings(accessToken)
      .then((data) => {
        if (!cancelled) setPreBookings(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Couldn't load pre-bookings.",
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
        All pre-bookings
      </h1>
      <p className="mt-1 text-muted">
        Every Vendor pre-booking against growing batches, read-only. Vendors
        manage cancellation and payment themselves; the 48-hour advance
        window auto-expires on its own.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : preBookings.length === 0 ? (
          <EmptyState icon="bookmark">No pre-bookings have been placed yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {preBookings.map((preBooking) => (
              <li
                key={preBooking.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <p className="font-[650] text-foreground">
                    {preBooking.batch.variety.name}
                  </p>
                  <p className="text-sm text-muted">
                    {preBooking.batch.crop.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    Vendor {preBooking.vendorId}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {preBooking.quantity} kg
                  </p>
                  {preBooking.status === "AWAITING_PAYMENT" &&
                    preBooking.holdExpiresAt && (
                      <PaymentDeadline expiresAt={preBooking.holdExpiresAt} />
                    )}
                </div>
                <PreBookingStatusBadge status={preBooking.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
