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
