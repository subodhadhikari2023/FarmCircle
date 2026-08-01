"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Listing, getListingsAsVendor } from "@/lib/listings";
import { ListingCard } from "@/components/listings/listing-card";

export default function VendorDashboardPage() {
  const { user, accessToken } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getListingsAsVendor(accessToken)
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load listings.");
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
        {user ? `Welcome back, ${user.name}` : "Browse the circle"}
      </h1>
      <p className="mt-1 text-muted">
        Live stock at wholesale pricing — straight from the grower.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading listings…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : listings.length === 0 ? (
          <p className="text-muted">
            No listings yet — check back soon as new batches come in.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                basePath="/vendor/listings"
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
