"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  createPreBookingPaymentIntent,
  verifyPreBookingPayment,
} from "@/lib/prebookings";

export function PayAdvanceButton({
  preBookingId,
  advanceAmount,
  razorpayReady,
  onPaid,
}: {
  preBookingId: string;
  advanceAmount: string;
  razorpayReady: boolean;
  onPaid: () => void;
}) {
  const { user, accessToken } = useAuth();

  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!accessToken) return;
    if (!razorpayReady) {
      setError("Payment is still loading. Try again in a moment.");
      return;
    }

    setError(null);
    setIsPaying(true);
    try {
      const intent = await createPreBookingPaymentIntent(
        accessToken,
        preBookingId,
      );

      const checkout = new window.Razorpay({
        key: intent.keyId,
        amount: Math.round(intent.amount * 100),
        currency: intent.currency,
        order_id: intent.razorpayOrderId,
        name: "FarmCircle",
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        handler: (response) => {
          void (async () => {
            try {
              await verifyPreBookingPayment(accessToken, preBookingId, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              onPaid();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Payment succeeded but couldn't be verified. Contact support.",
              );
            } finally {
              setIsPaying(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
      });
      checkout.open();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't start payment.",
      );
      setIsPaying(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPaying}
        onClick={() => void handlePay()}
        className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPaying
          ? "Processing…"
          : `Pay advance ₹${Number(advanceAmount).toFixed(2)}`}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
