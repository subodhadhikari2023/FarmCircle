import { API_URL } from "./api";

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
