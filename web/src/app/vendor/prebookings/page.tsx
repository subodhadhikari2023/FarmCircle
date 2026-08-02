"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PreBookingStatusBadge } from "@/components/ui/status-badge";
import { PaymentDeadline } from "@/components/ui/payment-deadline";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type PreBooking,
  cancelPreBooking,
  isPreBookingCancellable,
  listMyPreBookings,
} from "@/lib/prebookings";
import { PayAdvanceButton } from "@/components/listings/pay-advance-button";

export default function VendorPreBookingsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [preBookings, setPreBookings] = useState<PreBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [razorpayReady, setRazorpayReady] = useState(false);
  // Verify-payment only confirms the Checkout signature — the actual
  // QUEUED/AWAITING_PAYMENT -> CONFIRMED transition happens later, async,
  // once the Razorpay webhook lands. Track paid-but-not-yet-confirmed ids
  // locally so the row reflects it without waiting on a refetch.
  const [justPaidIds, setJustPaidIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listMyPreBookings(accessToken)
      .then((data) => {
        if (!cancelled) setPreBookings(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load pre-bookings.",
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

  async function handleCancel(id: string) {
    if (!accessToken) return;
    const confirmed = await confirm({
      title: "Cancel this pre-booking?",
      message: "This can't be undone.",
      confirmLabel: "Cancel pre-booking",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!confirmed) return;
    setCancellingId(id);
    setCancelError(null);
    try {
      const updated = await cancelPreBooking(accessToken, id);
      setPreBookings((prev) =>
        prev.map((preBooking) => (preBooking.id === id ? updated : preBooking)),
      );
      toast.show({ variant: "success", title: "Pre-booking cancelled" });
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Couldn't cancel the pre-booking.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        My pre-bookings
      </h1>
      <p className="mt-1 text-muted">
        Requests you&apos;ve placed against batches still growing.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : preBookings.length === 0 ? (
          <EmptyState icon="bookmark">
            No pre-bookings yet —{" "}
            <Link href="/vendor/upcoming" className="text-primary-text hover:underline">
              browse upcoming yield
            </Link>{" "}
            to request one.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {preBookings.map((preBooking) => (
              <li key={preBooking.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-[650] text-foreground">
                    {preBooking.batch.variety.name}
                  </p>
                  <p className="text-sm text-muted">{preBooking.batch.crop.name}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {preBooking.quantity} kg
                  </p>
                  {preBooking.status === "AWAITING_PAYMENT" &&
                    preBooking.holdExpiresAt && (
                      <PaymentDeadline expiresAt={preBooking.holdExpiresAt} />
                    )}
                </div>
                <PreBookingStatusBadge status={preBooking.status} />
                {isPreBookingCancellable(preBooking.status) && (
                  <button
                    type="button"
                    disabled={cancellingId === preBooking.id}
                    onClick={() => void handleCancel(preBooking.id)}
                    className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-danger-700 transition-colors hover:bg-background disabled:opacity-60"
                  >
                    {cancellingId === preBooking.id ? "Cancelling…" : "Cancel"}
                  </button>
                )}
                {preBooking.status === "AWAITING_PAYMENT" &&
                  preBooking.advanceAmount &&
                  (justPaidIds.has(preBooking.id) ? (
                    <p className="text-xs text-success-700">
                      Payment received — confirming shortly
                    </p>
                  ) : (
                    <PayAdvanceButton
                      preBookingId={preBooking.id}
                      advanceAmount={preBooking.advanceAmount}
                      razorpayReady={razorpayReady}
                      onPaid={() => {
                        setJustPaidIds((prev) => new Set(prev).add(preBooking.id));
                        toast.show({
                          variant: "success",
                          title: "Advance payment received",
                          message: "Confirming your pre-booking shortly.",
                        });
                      }}
                    />
                  ))}
              </li>
            ))}
          </ul>
        )}
        {cancelError && (
          <p role="alert" className="mt-3 text-sm text-danger-700">
            {cancelError}
          </p>
        )}
      </div>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRazorpayReady(true)}
      />
    </main>
  );
}
