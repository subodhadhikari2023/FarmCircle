import type { Listing } from "@/lib/listings";
import { RequestPreBookingForm } from "@/components/listings/request-prebooking-form";

// Draft listings for batches still growing — no availableQuantity/retail
// price to show yet (draft defaults), so this deliberately doesn't reuse
// ListingCard. No detail route exists for these: GET /inventory/:id 404s
// on unpublished listings, so the pre-booking form is embedded right here.
export function UpcomingListingCard({ listing }: { listing: Listing }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {listing.images[0] && (
        // eslint-disable-next-line @next/next/no-img-element -- grower-supplied URLs from arbitrary hosts, not configurable via next/image remotePatterns
        <img
          src={listing.images[0]}
          alt={`${listing.variety.name} (${listing.crop.name})`}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <div className="p-5">
        <h3 className="font-[650]">{listing.variety.name}</h3>
        <p className="text-sm text-muted">{listing.crop.name}</p>

        {listing.wholesalePrice && (
          <p className="mt-4 font-mono text-lg font-medium text-ink">
            ₹{Number(listing.wholesalePrice).toFixed(2)}
            <span className="text-sm font-normal text-muted"> /kg wholesale</span>
          </p>
        )}
        {listing.preBookableRemaining !== undefined ? (
          <p className="mt-1 text-sm text-muted">
            {listing.preBookableRemaining.toFixed(0)} kg still open to pre-book
          </p>
        ) : (
          listing.preBookablePercent && (
            <p className="mt-1 text-sm text-muted">
              {Number(listing.preBookablePercent).toFixed(0)}% of predicted yield
              open for pre-booking
            </p>
          )
        )}
        {listing.description && (
          <p className="mt-3 text-sm text-foreground">{listing.description}</p>
        )}

        {listing.batchId && (
          <RequestPreBookingForm
            batchId={listing.batchId}
            maxQuantity={listing.preBookableRemaining}
          />
        )}
      </div>
    </div>
  );
}
