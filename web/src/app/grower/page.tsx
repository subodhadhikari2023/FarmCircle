"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listMyListings, type ListingAdmin } from "@/lib/listings-admin";
import { listBatches, type Batch } from "@/lib/batches-admin";
import { listMyOrders, hasNextStatus, type Order } from "@/lib/orders-admin";
import { ROLE_SHELL } from "@/lib/role-shell";

type Counts = {
  liveListings: number;
  draftListings: number;
  activeBatches: number;
  ordersNeedingAction: number;
};

export default function GrowerDashboardPage() {
  const { user, accessToken } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([
      listMyListings(accessToken).catch((): ListingAdmin[] => []),
      listBatches(accessToken).catch((): Batch[] => []),
      listMyOrders(accessToken).catch((): Order[] => []),
    ]).then(([listings, batches, orders]) => {
      if (cancelled) return;
      setCounts({
        liveListings: listings.filter((l) => l.isPublished && !l.isClosed).length,
        draftListings: listings.filter((l) => !l.isPublished && !l.isClosed).length,
        activeBatches: batches.filter((b) => !b.harvestConfirmed).length,
        ordersNeedingAction: orders.filter((o) => hasNextStatus(o.status)).length,
      });
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const links = ROLE_SHELL.GROWER.links;

  return (
    <main className="mx-auto flex-1 max-w-5xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        {user ? `Welcome back, ${user.name}` : "Grower dashboard"}
      </h1>
      <p className="mt-1 text-muted">
        Your crops, growing batches, listings, and incoming orders, at a glance.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon="sell"
          value={isLoading ? null : counts?.liveListings ?? 0}
          label="Live listings"
          href="/grower/listings"
        />
        <SummaryCard
          icon="inventory_2"
          value={isLoading ? null : counts?.activeBatches ?? 0}
          label="Batches growing"
          href="/grower/batches"
        />
        <SummaryCard
          icon="receipt_long"
          value={isLoading ? null : counts?.ordersNeedingAction ?? 0}
          label="Orders to fulfill"
          href="/grower/orders"
          highlight={(counts?.ordersNeedingAction ?? 0) > 0}
        />
        <SummaryCard
          icon="edit_note"
          value={isLoading ? null : counts?.draftListings ?? 0}
          label="Draft listings"
          href="/grower/listings"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-icy-aqua-50 text-primary-text"
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
