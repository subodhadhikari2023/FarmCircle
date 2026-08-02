"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Past due";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `~${hours}h ${minutes}m left to pay`;
  return `~${minutes}m left to pay`;
}

const URGENT_MS = 60 * 60_000; // under 1h — danger
const SOON_MS = 6 * 60 * 60_000; // under 6h — warning

// Live-updating countdown for the 48h pre-booking advance-payment hold —
// a static localized timestamp gave no sense of urgency for the one
// deadline in the app with a real financial consequence if missed.
export function PaymentDeadline({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [target]);

  const isPastDue = remaining <= 0;
  const isUrgent = remaining <= URGENT_MS;
  const isSoon = remaining <= SOON_MS;

  const classes = isPastDue || isUrgent
    ? "text-danger-700"
    : isSoon
      ? "text-warning-800"
      : "text-muted";

  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${classes}`}>
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {isPastDue || isUrgent ? "error" : "schedule"}
      </span>
      {formatRemaining(remaining)}
    </p>
  );
}
