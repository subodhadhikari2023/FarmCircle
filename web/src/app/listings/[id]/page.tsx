import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/listings";
import { getBatchTimeline } from "@/lib/batches";
import { ListingTimeline } from "@/components/listings/listing-timeline";

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

  return (
    <main className="mx-auto flex-1 max-w-3xl px-6 py-16">
      <Link
        href="/listings"
        className="text-sm text-primary-text hover:underline"
      >
        ← Back to listings
      </Link>

      {listing.images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {listing.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element -- grower-supplied URLs from arbitrary hosts, not configurable via next/image remotePatterns
            <img
              key={src}
              src={src}
              alt={`${listing.variety.name} (${listing.crop.name})`}
              className="aspect-square w-full rounded-md border border-border object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{listing.variety.name}</h1>
          <p className="mt-1 text-muted">{listing.crop.name}</p>
        </div>
        {listing.hasTrackedCycle && (
          <span className="shrink-0 rounded-full bg-icy-aqua-50 px-3 py-1 text-xs font-medium text-primary-text">
            Tracked from planting
          </span>
        )}
      </div>

      <p className="mt-8 font-mono text-2xl font-medium text-ink">
        ₹{Number(listing.retailPrice).toFixed(2)}
        <span className="text-base font-normal text-muted"> /kg</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        {Number(listing.availableQuantity).toFixed(0)} kg available
      </p>
      {listing.isOrganicCertified && (
        <p className="mt-2 text-sm font-medium text-success-700">
          Organic certified
        </p>
      )}

      {listing.description && (
        <p className="mt-8 leading-relaxed text-foreground">
          {listing.description}
        </p>
      )}

      {timeline && <ListingTimeline timeline={timeline} />}
    </main>
  );
}
