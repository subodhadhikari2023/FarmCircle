"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Listing, getListingAsVendor } from "@/lib/listings";
import { type BatchTimeline, getBatchTimeline } from "@/lib/batches";
import { ListingDetail } from "@/components/listings/listing-detail";

export default function VendorListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [timeline, setTimeline] = useState<BatchTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getListingAsVendor(accessToken, id)
      .then(async (data) => {
        if (cancelled) return;
        setListing(data);
        if (data.hasTrackedCycle && data.batchId) {
          const timelineData = await getBatchTimeline(data.batchId);
          if (!cancelled) setTimeline(timelineData);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFoundFlag(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  if (notFoundFlag) {
    notFound();
  }

  if (isLoading || !listing) {
    return (
      <main
        role="status"
        aria-label="Loading listing"
        className="mx-auto flex-1 max-w-3xl px-6 py-16"
      >
        <div aria-hidden="true" className="h-5 w-32 animate-pulse rounded-sm bg-border" />
        <div aria-hidden="true" className="mt-6 h-9 w-48 animate-pulse rounded-sm bg-border" />
        <div aria-hidden="true" className="mt-2 h-5 w-32 animate-pulse rounded-sm bg-border" />
        <div aria-hidden="true" className="mt-8 h-8 w-40 animate-pulse rounded-sm bg-border" />
      </main>
    );
  }

  return <ListingDetail listing={listing} timeline={timeline} backHref="/vendor" />;
}
