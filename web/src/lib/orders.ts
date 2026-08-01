import { apiFetch } from "./api";

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "OUT_FOR_DELIVERY"
  | "READY_FOR_PICKUP"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

export type Order = {
  id: string;
  buyerId: string;
  listingId: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  deliveryMethod: "DELIVERY" | "PICKUP";
  addressId: string | null;
  status: OrderStatus;
  paymentMethod: "COD" | "UPI" | "ONLINE";
  createdAt: string;
  updatedAt: string;
};

export type OrderStatusHistoryEntry = {
  status: OrderStatus;
  changedAt: string;
  changedBy?: string;
};

export type OrderDetail = Order & {
  statusHistory: OrderStatusHistoryEntry[];
};

// Statuses the buyer can still back out of (mirrors CANCELLABLE_STATUSES in
// api/src/order/orders.service.ts) — used to grey out the button client-side;
// the server is still the source of truth (409s if we get this wrong).
const CANCELLABLE_STATUSES: OrderStatus[] = ["PLACED", "CONFIRMED"];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

const REVIEWABLE_STATUSES: OrderStatus[] = ["DELIVERED", "PICKED_UP"];

export function isReviewable(status: OrderStatus): boolean {
  return REVIEWABLE_STATUSES.includes(status);
}

export type CreateOrderInput = {
  listingId: string;
  quantity: number;
  deliveryMethod: "DELIVERY" | "PICKUP";
  addressId?: string;
  paymentMethod: "COD" | "UPI" | "ONLINE";
};

// Returned by POST /orders when paymentMethod is UPI/ONLINE — no Order
// exists yet at this point, only an OrderIntent + a Razorpay order to open
// Checkout against. The Order is created later, asynchronously, by the
// Razorpay webhook (see orders.ts consumers for how this is handled).
export type OrderIntentPayment = {
  orderIntentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

export function isOrderIntentPayment(
  result: Order | OrderIntentPayment,
): result is OrderIntentPayment {
  return "orderIntentId" in result;
}

export function createOrder(
  accessToken: string,
  input: CreateOrderInput,
): Promise<Order | OrderIntentPayment> {
  return apiFetch<Order | OrderIntentPayment>("/orders", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type VerifyOrderPaymentInput = {
  orderIntentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

// Confirms the Checkout signature and marks the Payment row SUCCESS. Does
// NOT create the Order — that only happens once the Razorpay webhook lands,
// which is why callers redirect to the order list, not an order detail page.
export function verifyOrderPayment(
  accessToken: string,
  input: VerifyOrderPaymentInput,
): Promise<unknown> {
  return apiFetch<unknown>("/orders/verify-payment", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMyOrders(accessToken: string): Promise<Order[]> {
  return apiFetch<Order[]>("/orders", accessToken);
}

export function getOrder(
  accessToken: string,
  id: string,
): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/orders/${id}`, accessToken);
}

export function cancelOrder(
  accessToken: string,
  id: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/cancel`, accessToken, {
    method: "PATCH",
  });
}

// Admin-only manual override — sets status directly (any OrderStatus, not
// just the next step in the fixed delivery/pickup state machine), for
// resolving stuck orders. Releases reserved stock if the new status is
// CANCELLED and the order wasn't already (mirrors OrdersService.dispute).
export function disputeOrder(
  accessToken: string,
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/dispute`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
