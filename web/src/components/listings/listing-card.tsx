import Link from "next/link";
import type { Listing } from "@/lib/listings";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="block overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-primary"
    >
      {listing.images[0] && (
        // eslint-disable-next-line @next/next/no-img-element -- grower-supplied URLs from arbitrary hosts, not configurable via next/image remotePatterns
        <img
          src={listing.images[0]}
          alt={`${listing.variety.name} (${listing.crop.name})`}
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-[650]">{listing.variety.name}</h3>
            <p className="text-sm text-muted">{listing.crop.name}</p>
          </div>
          {listing.hasTrackedCycle && (
            <span className="rounded-full bg-icy-aqua-50 px-2 py-0.5 text-xs font-medium text-primary-text">
              Tracked
            </span>
          )}
        </div>
        <p className="mt-4 font-mono text-lg font-medium text-ink">
          ₹{Number(listing.retailPrice).toFixed(2)}
          <span className="text-sm font-normal text-muted"> /kg</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {Number(listing.availableQuantity).toFixed(0)} kg available
        </p>
        {listing.isOrganicCertified && (
          <p className="mt-2 text-xs font-medium text-success-700">
            Organic certified
          </p>
        )}
      </div>
    </Link>
  );
}
