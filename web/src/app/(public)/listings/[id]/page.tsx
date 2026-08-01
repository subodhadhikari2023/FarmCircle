import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/listings";
import { getBatchTimeline } from "@/lib/batches";
import { ListingDetail } from "@/components/listings/listing-detail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found" };
  return { title: `${listing.variety.name} — ${listing.crop.name}` };
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const timeline =
    listing.hasTrackedCycle && listing.batchId
      ? await getBatchTimeline(listing.batchId)
      : null;

  return <ListingDetail listing={listing} timeline={timeline} backHref="/listings" />;
}
