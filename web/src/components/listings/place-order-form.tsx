"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { type Address, listAddresses } from "@/lib/addresses";
import {
  createOrder,
  isOrderIntentPayment,
  verifyOrderPayment,
} from "@/lib/orders";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export function PlaceOrderForm({
  listingId,
  availableQuantity,
}: {
  listingId: string;
  availableQuantity: number;
}) {
  const { user, status, accessToken } = useAuth();
  const router = useRouter();

  const [quantity, setQuantity] = useState("1");
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "DELIVERY">(
    "PICKUP",
  );
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<
    "COD" | "UPI" | "ONLINE"
  >("COD");
  const [razorpayReady, setRazorpayReady] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomer = status === "authenticated" && user?.role === "CUSTOMER";

  useEffect(() => {
    if (!isCustomer || !accessToken) return;
    listAddresses(accessToken)
      .then((data) => setAddresses(data))
      .catch(() => setAddresses([]))
      .finally(() => setIsLoadingAddresses(false));
  }, [isCustomer, accessToken]);

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="mt-8 h-32 animate-pulse rounded-md border border-border bg-surface"
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mt-8 rounded-md border border-border bg-surface p-5">
        <p className="text-sm text-foreground">
          <Link href="/login" className="font-medium text-primary-text hover:underline">
            Log in
          </Link>{" "}
          as a customer to place an order.
        </p>
      </div>
    );
  }

  if (!isCustomer) {
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
    if (deliveryMethod === "DELIVERY" && !addressId) {
      setSubmitError("Select a delivery address.");
      return;
    }

    if (paymentMethod !== "COD" && !razorpayReady) {
      setSubmitError("Payment is still loading. Try again in a moment.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await createOrder(accessToken, {
        listingId,
        quantity: parsedQuantity,
        deliveryMethod,
        addressId: deliveryMethod === "DELIVERY" ? addressId : undefined,
        paymentMethod,
      });

      if (!isOrderIntentPayment(result)) {
        router.push(`/customer/orders/${result.id}`);
        return;
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        amount: Math.round(result.amount * 100),
        currency: result.currency,
        order_id: result.razorpayOrderId,
        name: "FarmCircle",
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        method:
          paymentMethod === "UPI"
            ? { upi: "1", card: "0", netbanking: "0", wallet: "0" }
            : { upi: "0", card: "1", netbanking: "1", wallet: "0" },
        handler: (response) => {
          void (async () => {
            try {
              await verifyOrderPayment(accessToken, {
                orderIntentId: result.orderIntentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              router.push("/customer/orders?paid=1");
            } catch (err) {
              setSubmitError(
                err instanceof Error
                  ? err.message
                  : "Payment succeeded but couldn't be verified. Contact support.",
              );
              setIsSubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
          },
        },
      });
      checkout.open();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't place the order.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-8 flex flex-col gap-4 rounded-md border border-border bg-surface p-5"
    >
      <h2 className="font-[650] text-ink">Place an order</h2>

      <div>
        <label htmlFor="order-quantity" className="mb-1 block text-sm font-medium text-foreground">
          Quantity (kg)
        </label>
        <input
          id="order-quantity"
          type="number"
          min="0.01"
          step="0.01"
          max={availableQuantity || undefined}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="order-delivery-method" className="mb-1 block text-sm font-medium text-foreground">
          Delivery method
        </label>
        <select
          id="order-delivery-method"
          value={deliveryMethod}
          onChange={(event) =>
            setDeliveryMethod(event.target.value as "PICKUP" | "DELIVERY")
          }
          className={INPUT_CLASS}
        >
          <option value="PICKUP">Pickup</option>
          <option value="DELIVERY">Delivery</option>
        </select>
      </div>

      {deliveryMethod === "DELIVERY" && (
        <div>
          <label htmlFor="order-address" className="mb-1 block text-sm font-medium text-foreground">
            Delivery address
          </label>
          {isLoadingAddresses ? (
            <p className="text-sm text-muted">Loading addresses…</p>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted">
              You don&apos;t have any saved addresses yet.{" "}
              <Link
                href="/customer/addresses"
                className="font-medium text-primary-text hover:underline"
              >
                Add one
              </Link>{" "}
              first.
            </p>
          ) : (
            <select
              id="order-address"
              value={addressId}
              onChange={(event) => setAddressId(event.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select an address
              </option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.addressText}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-foreground">
          Payment method
        </span>
        <div className="flex flex-col gap-2 text-sm text-foreground">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment-method"
              checked={paymentMethod === "COD"}
              onChange={() => setPaymentMethod("COD")}
            />
            Cash on delivery / pickup
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment-method"
              checked={paymentMethod === "UPI"}
              onChange={() => setPaymentMethod("UPI")}
            />
            UPI
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment-method"
              checked={paymentMethod === "ONLINE"}
              onChange={() => setPaymentMethod("ONLINE")}
            />
            Card / net banking
          </label>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-danger-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          (deliveryMethod === "DELIVERY" && addresses.length === 0)
        }
        className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Placing order…" : "Place order"}
      </button>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRazorpayReady(true)}
      />
    </form>
  );
}
