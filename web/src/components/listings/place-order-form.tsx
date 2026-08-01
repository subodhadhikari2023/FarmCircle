"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { type Address, listAddresses } from "@/lib/addresses";
import { createOrder } from "@/lib/orders";

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

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const order = await createOrder(accessToken, {
        listingId,
        quantity: parsedQuantity,
        deliveryMethod,
        addressId: deliveryMethod === "DELIVERY" ? addressId : undefined,
        paymentMethod: "COD",
      });
      router.push(`/customer/orders/${order.id}`);
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
            <input type="radio" name="payment-method" checked readOnly />
            Cash on delivery / pickup
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="radio" name="payment-method" disabled />
            UPI (coming soon)
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="radio" name="payment-method" disabled />
            Online payment (coming soon)
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
    </form>
  );
}
