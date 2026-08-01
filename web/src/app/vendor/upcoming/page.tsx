"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Listing, getUpcomingListings } from "@/lib/listings";
import { UpcomingListingCard } from "@/components/listings/upcoming-listing-card";

export default function VendorUpcomingPage() {
  const { accessToken } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getUpcomingListings(accessToken)
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load upcoming batches.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <main className="mx-auto flex-1 max-w-5xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        Pre-book upcoming yield
      </h1>
      <p className="mt-1 text-muted">
        Batches still growing. Reserve a quantity now, pay a 20% advance once
        it&apos;s harvest-ready.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : listings.length === 0 ? (
          <p className="text-muted">
            Nothing open for pre-booking right now — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <UpcomingListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
