import { apiFetch } from "./api";

// Grower-authenticated shape — unlike the public `Listing` type in
// `listings.ts`, this always includes price fields (wholesalePrice,
// minWholesaleQty), since these responses come straight from the owning
// Grower's own create/draft calls with no visibility stripping applied.
export type ListingAdmin = {
  id: string;
  ownerId: string;
  cropId: string;
  varietyId: string;
  batchId: string | null;
  hasTrackedCycle: boolean;
  retailPrice: string;
  wholesalePrice: string;
  minWholesaleQty: string;
  retailCeilingPercent: string;
  preBookablePercent: string;
  availableQuantity: string;
  isPublished: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  images: string[];
  isOrganicCertified: boolean;
  attributes?: Record<string, unknown>;
  // Only present on responses that include the crop/variety relations
  // (GET /inventory/mine) — absent on create/update/close.
  crop?: { name: string };
  variety?: { name: string };
};

export type CreateListingInput = {
  cropId: string;
  varietyId: string;
  retailPrice: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  retailCeilingPercent: number;
  preBookablePercent: number;
  availableQuantity: number;
  description?: string;
  isOrganicCertified?: boolean;
};

export type ListingTermsInput = Omit<
  CreateListingInput,
  "cropId" | "varietyId" | "availableQuantity"
>;

export type UpdateListingInput = {
  availableQuantity?: number;
  description?: string;
  isOrganicCertified?: boolean;
};

export function listMyListings(accessToken: string): Promise<ListingAdmin[]> {
  return apiFetch<ListingAdmin[]>("/inventory/mine", accessToken);
}

export function createListing(
  accessToken: string,
  input: CreateListingInput,
): Promise<ListingAdmin> {
  return apiFetch<ListingAdmin>("/inventory", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateListing(
  accessToken: string,
  id: string,
  input: UpdateListingInput,
): Promise<ListingAdmin> {
  return apiFetch<ListingAdmin>(`/inventory/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function closeListing(
  accessToken: string,
  id: string,
): Promise<ListingAdmin> {
  return apiFetch<ListingAdmin>(`/inventory/${id}/close`, accessToken, {
    method: "PATCH",
  });
}

// Creates the (unpublished) draft Listing tied to a tracked Batch. Not in
// docs/FarmCircle-API-Design.md — found by reading InventoryController
// directly. Must be called before PATCH /batches/:id/confirm-harvest, which
// 409s if no Listing exists yet for the batch.
export function createDraftFromBatch(
  accessToken: string,
  batchId: string,
  input: ListingTermsInput,
): Promise<ListingAdmin> {
  return apiFetch<ListingAdmin>(
    `/inventory/from-batch/${batchId}`,
    accessToken,
    { method: "POST", body: JSON.stringify(input) },
  );
}
