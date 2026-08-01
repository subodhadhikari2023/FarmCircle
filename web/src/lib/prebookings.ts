import { apiFetch } from "./api";

export type PreBookingStatus =
  | "QUEUED"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED";

export type PreBooking = {
  id: string;
  vendorId: string;
  batchId: string;
  listingId: string | null;
  quantity: string;
  status: PreBookingStatus;
  advanceAmount: string | null;
  holdExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Included by GET /prebookings and GET /prebookings/:id so the list/detail
  // views don't have to show a raw batchId.
  batch: {
    crop: { name: string };
    variety: { name: string };
  };
};

// Only QUEUED pre-bookings can be manually cancelled — once stock goes
// live (AWAITING_PAYMENT), the only exit is the 48h auto-expiry sweep.
const CANCELLABLE_STATUSES: PreBookingStatus[] = ["QUEUED"];

export function isPreBookingCancellable(status: PreBookingStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

export type CreatePreBookingInput = {
  batchId: string;
  quantity: number;
};

export function createPreBooking(
  accessToken: string,
  input: CreatePreBookingInput,
): Promise<PreBooking> {
  return apiFetch<PreBooking>("/prebookings", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMyPreBookings(accessToken: string): Promise<PreBooking[]> {
  return apiFetch<PreBooking[]>("/prebookings", accessToken);
}

export function getPreBooking(
  accessToken: string,
  id: string,
): Promise<PreBooking> {
  return apiFetch<PreBooking>(`/prebookings/${id}`, accessToken);
}

export function cancelPreBooking(
  accessToken: string,
  id: string,
): Promise<PreBooking> {
  return apiFetch<PreBooking>(`/prebookings/${id}/cancel`, accessToken, {
    method: "PATCH",
  });
}

// GET /prebookings/:id/payment-intent — only once AWAITING_PAYMENT. Creates
// (or reuses) a Razorpay order for the 20% advance and returns what Checkout
// needs to open. No Order/PreBooking status change happens here — that's
// the webhook's job once payment.captured actually lands.
export type PreBookingPaymentIntent = {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

export function createPreBookingPaymentIntent(
  accessToken: string,
  id: string,
): Promise<PreBookingPaymentIntent> {
  return apiFetch<PreBookingPaymentIntent>(
    `/prebookings/${id}/payment-intent`,
    accessToken,
  );
}

export type VerifyPreBookingPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

// Confirms the Checkout signature and marks the Payment row SUCCESS. Does
// NOT move the pre-booking to CONFIRMED — that only happens once the
// Razorpay webhook lands, same as the direct-order flow in orders.ts.
export function verifyPreBookingPayment(
  accessToken: string,
  id: string,
  input: VerifyPreBookingPaymentInput,
): Promise<unknown> {
  return apiFetch<unknown>(`/prebookings/${id}/verify-payment`, accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
