import type { Metadata } from "next";
import { ListingCard } from "@/components/listings/listing-card";
import { getListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Browse the circle",
};

export default async function ListingsPage() {
  const listings = await getListings();

  return (
    <main className="mx-auto flex-1 max-w-5xl px-6 py-16">
      <h1 className="text-3xl">Browse the circle</h1>
      <p className="mt-2 text-muted">
        Every listing below comes straight from the grower — no resellers, no
        middlemen.
      </p>

      {listings.length === 0 ? (
        <p className="mt-12 text-muted">
          No listings yet — check back soon as new batches come in.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </main>
  );
}
