"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listUsers, type ManagedUser } from "@/lib/users";
import { listMyOrders as listAllOrders, type Order } from "@/lib/orders";
import { hasNextStatus } from "@/lib/orders-admin";
import { listMyPreBookings, type PreBooking } from "@/lib/prebookings";
import { listHiddenReviews, type Review } from "@/lib/reviews";
import { ROLE_SHELL } from "@/lib/role-shell";

type Counts = {
  suspendedUsers: number;
  activeOrders: number;
  awaitingPayment: number;
  hiddenReviews: number;
};

export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([
      listUsers(accessToken).catch((): ManagedUser[] => []),
      listAllOrders(accessToken).catch((): Order[] => []),
      listMyPreBookings(accessToken).catch((): PreBooking[] => []),
      listHiddenReviews(accessToken).catch((): Review[] => []),
    ]).then(([users, orders, preBookings, hidden]) => {
      if (cancelled) return;
      setCounts({
        suspendedUsers: users.filter((u) => u.isSuspended).length,
        activeOrders: orders.filter((o) => hasNextStatus(o.status)).length,
        awaitingPayment: preBookings.filter((p) => p.status === "AWAITING_PAYMENT").length,
        hiddenReviews: hidden.length,
      });
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const links = ROLE_SHELL.ADMIN.links;

  return (
    <main className="mx-auto flex-1 max-w-5xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        {user ? `Welcome back, ${user.name}` : "Admin dashboard"}
      </h1>
      <p className="mt-1 text-muted">
        Platform-wide accounts, orders, pre-bookings, and reviews, at a glance.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon="receipt_long"
          value={isLoading ? null : counts?.activeOrders ?? 0}
          label="Orders in flight"
          href="/admin/orders"
        />
        <SummaryCard
          icon="payments"
          value={isLoading ? null : counts?.awaitingPayment ?? 0}
          label="Awaiting advance payment"
          href="/admin/prebookings"
        />
        <SummaryCard
          icon="person_off"
          value={isLoading ? null : counts?.suspendedUsers ?? 0}
          label="Suspended accounts"
          href="/admin/users"
          highlight={(counts?.suspendedUsers ?? 0) > 0}
        />
        <SummaryCard
          icon="visibility_off"
          value={isLoading ? null : counts?.hiddenReviews ?? 0}
          label="Hidden reviews"
          href="/admin/reviews"
        />
      </div>

      <h2 className="mt-10 font-display text-lg font-[650] text-ink">
        Go to
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-primary"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dark-slate-grey-100 text-dark-slate-grey-800"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            </span>
            <span className="font-medium text-foreground">{link.label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  href,
  highlight,
}: {
  icon: string;
  value: number | null;
  label: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border p-4 transition-colors hover:border-primary ${
        highlight ? "border-warning-200 bg-warning-100" : "border-border bg-surface"
      }`}
    >
      <span
        className={`material-symbols-outlined text-[18px] ${highlight ? "text-warning-800" : "text-muted"}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p
        className={`mt-2 font-mono text-2xl font-medium ${highlight ? "text-warning-800" : "text-ink"}`}
      >
        {value === null ? (
          <span className="inline-block h-7 w-8 animate-pulse rounded-sm bg-border align-middle" />
        ) : (
          value
        )}
      </p>
      <p className={`text-xs ${highlight ? "text-warning-800" : "text-muted"}`}>{label}</p>
    </Link>
  );
}
