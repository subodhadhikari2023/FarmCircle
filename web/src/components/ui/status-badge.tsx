import type { OrderStatus } from "@/lib/orders";
import type { PreBookingStatus } from "@/lib/prebookings";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-100 text-success-800",
  warning: "bg-warning-100 text-warning-800",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-frosted-blue-50 text-frosted-blue-800",
  neutral: "bg-granite-200 text-granite-800",
};

function Badge({ tone, icon, label }: { tone: Tone; icon: string; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

const ORDER_STATUS_TONE: Record<OrderStatus, { tone: Tone; icon: string }> = {
  PLACED: { tone: "neutral", icon: "receipt_long" },
  CONFIRMED: { tone: "info", icon: "task_alt" },
  OUT_FOR_DELIVERY: { tone: "warning", icon: "local_shipping" },
  READY_FOR_PICKUP: { tone: "warning", icon: "storefront" },
  DELIVERED: { tone: "success", icon: "check_circle" },
  PICKED_UP: { tone: "success", icon: "check_circle" },
  CANCELLED: { tone: "danger", icon: "cancel" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { tone, icon } = ORDER_STATUS_TONE[status];
  return <Badge tone={tone} icon={icon} label={ORDER_STATUS_LABEL[status]} />;
}

const PREBOOKING_STATUS_LABEL: Record<PreBookingStatus, string> = {
  QUEUED: "Queued",
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const PREBOOKING_STATUS_TONE: Record<PreBookingStatus, { tone: Tone; icon: string }> = {
  QUEUED: { tone: "neutral", icon: "hourglass_top" },
  AWAITING_PAYMENT: { tone: "warning", icon: "payments" },
  CONFIRMED: { tone: "success", icon: "check_circle" },
  EXPIRED: { tone: "danger", icon: "schedule" },
  CANCELLED: { tone: "danger", icon: "cancel" },
};

export function PreBookingStatusBadge({ status }: { status: PreBookingStatus }) {
  const { tone, icon } = PREBOOKING_STATUS_TONE[status];
  return <Badge tone={tone} icon={icon} label={PREBOOKING_STATUS_LABEL[status]} />;
}
