"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { createPreBooking } from "@/lib/prebookings";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export function RequestPreBookingForm({
  batchId,
  maxQuantity,
}: {
  batchId: string;
  // Soft client-side cap for UX — the server (Redis-backed, atomic) is
  // still the source of truth and will 409 if this is stale or exceeded.
  maxQuantity?: number;
}) {
  const { user, status, accessToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [quantity, setQuantity] = useState("1");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status !== "authenticated" || user?.role !== "VENDOR" || !accessToken) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setSubmitError("Enter a valid quantity.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createPreBooking(accessToken, { batchId, quantity: parsedQuantity });
      toast.show({
        variant: "success",
        title: "Pre-booking requested",
        message: "You'll pay a 20% advance once the batch is harvest-ready.",
      });
      router.push("/vendor/prebookings");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't request the pre-booking.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-4 flex flex-col gap-3 border-t border-border pt-4"
    >
      <div>
        <label
          htmlFor={`prebooking-quantity-${batchId}`}
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Quantity (kg)
        </label>
        <input
          id={`prebooking-quantity-${batchId}`}
          type="number"
          min="0.01"
          step="0.01"
          max={maxQuantity || undefined}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-danger-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-1.5 self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          bookmark_add
        </span>
        {isSubmitting ? "Requesting…" : "Request pre-booking"}
      </button>
    </form>
  );
}
