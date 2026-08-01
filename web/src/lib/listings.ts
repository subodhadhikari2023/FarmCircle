import { API_URL, apiFetch } from "./api";

export type Listing = {
  id: string;
  batchId: string | null;
  hasTrackedCycle: boolean;
  retailPrice: string;
  availableQuantity: string;
  isOrganicCertified: boolean;
  description?: string;
  images: string[];
  crop: { name: string };
  variety: { name: string };
  // Only present when fetched by an authenticated Vendor (see
  // ListingsService.applyVisibility on the backend) — stripped for
  // everyone else, including unauthenticated anonymous fetches.
  wholesalePrice?: string;
  minWholesaleQty?: string;
  preBookablePercent?: string;
  // Only present on GET /inventory/upcoming (Vendor-only) — computed
  // server-side as (predictedYield * preBookablePercent / 100) minus what's
  // already reserved in Redis. Never the raw predictedYield/Batch entity.
  preBookableRemaining?: number;
};

export async function getListings(): Promise<Listing[]> {
  try {
    const res = await fetch(`${API_URL}/inventory`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return (await res.json()) as Listing[];
  } catch {
    return [];
  }
}

export async function getListing(id: string): Promise<Listing | null> {
  try {
    const res = await fetch(`${API_URL}/inventory/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Listing;
  } catch {
    return null;
  }
}

// Authenticated variants — send the Vendor's access token so the backend
// includes wholesalePrice/minWholesaleQty (see Listing type above). The
// anonymous getListings()/getListing() above never see those fields.
export function getListingsAsVendor(accessToken: string): Promise<Listing[]> {
  return apiFetch<Listing[]>("/inventory", accessToken);
}

export function getListingAsVendor(
  accessToken: string,
  id: string,
): Promise<Listing> {
  return apiFetch<Listing>(`/inventory/${id}`, accessToken);
}

// GET /inventory/upcoming — Vendor-only, no anonymous fallback. Draft
// listings for batches still growing, open for pre-booking.
export function getUpcomingListings(accessToken: string): Promise<Listing[]> {
  return apiFetch<Listing[]>("/inventory/upcoming", accessToken);
}
