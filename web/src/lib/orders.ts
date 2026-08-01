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

// Only COD is wired up here — UPI/ONLINE go through OrderIntent + Razorpay
// Checkout, deferred until the payment integration pass.
export type CreateOrderInput = {
  listingId: string;
  quantity: number;
  deliveryMethod: "DELIVERY" | "PICKUP";
  addressId?: string;
  paymentMethod: "COD";
};

export function createOrder(
  accessToken: string,
  input: CreateOrderInput,
): Promise<Order> {
  return apiFetch<Order>("/orders", accessToken, {
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
