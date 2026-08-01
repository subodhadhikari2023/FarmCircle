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
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
};

// Terminal statuses with no further advance step (mirrors NEXT_STATUS in
// api/src/order/orders.service.ts) — used to grey out the button client-side;
// the server is still the source of truth (409s if we get this wrong).
const TERMINAL_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
];

export function hasNextStatus(status: OrderStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

// Grower-only. Lists orders on the requesting Grower's own listings.
export function listMyOrders(accessToken: string): Promise<Order[]> {
  return apiFetch<Order[]>("/orders", accessToken);
}

// Grower-only. Advances the order one step along a fixed state machine
// derived from deliveryMethod — no request body, no target status to pick.
export function advanceOrderStatus(
  accessToken: string,
  orderId: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}/status`, accessToken, {
    method: "PATCH",
  });
}
