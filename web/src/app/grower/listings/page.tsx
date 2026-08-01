"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { type Crop, listCrops } from "@/lib/crops";
import { type Variety, listVarieties } from "@/lib/varieties";
import {
  type ListingAdmin,
  type UpdateListingInput,
  closeListing,
  createListing,
  listMyListings,
  updateListing,
} from "@/lib/listings-admin";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

type ManagedListing = {
  id: string;
  availableQuantity: string;
  description: string;
  isOrganicCertified: boolean;
  retailPrice?: string;
  wholesalePrice?: string;
};

function fromAdmin(listing: ListingAdmin): ManagedListing {
  return {
    id: listing.id,
    availableQuantity: listing.availableQuantity,
    description: listing.description ?? "",
    // PATCH /inventory/:id/close returns the raw Prisma row without the
    // usual Mongo content merge (unlike create/update), so this can be
    // missing even though ListingAdmin types it as required.
    isOrganicCertified: listing.isOrganicCertified ?? false,
    retailPrice: listing.retailPrice,
    wholesalePrice: listing.wholesalePrice,
  };
}

export default function GrowerListingsPage() {
  const { accessToken } = useAuth();

  const [listings, setListings] = useState<ListingAdmin[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [cropId, setCropId] = useState("");
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [varietyId, setVarietyId] = useState("");

  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minWholesaleQty, setMinWholesaleQty] = useState("");
  const [retailCeilingPercent, setRetailCeilingPercent] = useState("10");
  const [preBookablePercent, setPreBookablePercent] = useState("60");
  const [availableQuantity, setAvailableQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [isOrganicCertified, setIsOrganicCertified] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [managed, setManaged] = useState<ManagedListing | null>(null);

  const [editQuantity, setEditQuantity] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOrganic, setEditOrganic] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    listCrops(accessToken)
      .then(setCrops)
      .catch(() => setCrops([]));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listMyListings(accessToken)
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListingsError(
            err instanceof Error ? err.message : "Couldn't load listings.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingListings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !cropId) return;
    let cancelled = false;
    listVarieties(accessToken, cropId)
      .then((data) => {
        if (cancelled) return;
        setVarieties(data);
        setVarietyId("");
      })
      .catch(() => {
        if (!cancelled) setVarieties([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, cropId]);

  function loadIntoEditor(listing: ManagedListing) {
    setManaged(listing);
    setEditQuantity(listing.availableQuantity);
    setEditDescription(listing.description);
    setEditOrganic(listing.isOrganicCertified);
    setEditError(null);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const listing = await createListing(accessToken, {
        cropId,
        varietyId,
        retailPrice: Number(retailPrice),
        wholesalePrice: Number(wholesalePrice),
        minWholesaleQty: Number(minWholesaleQty),
        retailCeilingPercent: Number(retailCeilingPercent),
        preBookablePercent: Number(preBookablePercent),
        availableQuantity: Number(availableQuantity),
        description: description.trim() || undefined,
        isOrganicCertified,
      });
      setListings((prev) => [listing, ...prev]);
      loadIntoEditor(fromAdmin(listing));
      setRetailPrice("");
      setWholesalePrice("");
      setMinWholesaleQty("");
      setAvailableQuantity("");
      setDescription("");
      setIsOrganicCertified(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create listing.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !managed) return;
    setEditError(null);
    setIsSaving(true);
    try {
      const input: UpdateListingInput = {
        availableQuantity: Number(editQuantity),
        description: editDescription.trim() || undefined,
        isOrganicCertified: editOrganic,
      };
      const listing = await updateListing(accessToken, managed.id, input);
      // update()/close() responses don't include the crop/variety relations
      // that findMine() does — merge onto the existing row instead of
      // replacing it outright, so the list keeps showing crop/variety names.
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, ...listing } : l)),
      );
      loadIntoEditor(fromAdmin(listing));
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Couldn't update listing.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClose() {
    if (!accessToken || !managed) return;
    if (!window.confirm("Close this listing? Buyers won't be able to order it anymore.")) {
      return;
    }
    setEditError(null);
    setIsClosing(true);
    try {
      const listing = await closeListing(accessToken, managed.id);
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, ...listing } : l)),
      );
      loadIntoEditor(fromAdmin(listing));
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Couldn't close listing.",
      );
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Listings</h1>
      <p className="mt-1 text-muted">
        Create a listing straight from a Crop and Variety — no batch tracking
        required. Once created, prices are locked; only stock and description
        stay editable.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="listing-crop" className="mb-1 block text-sm font-medium text-foreground">
              Crop
            </label>
            <select
              id="listing-crop"
              value={cropId}
              onChange={(event) => setCropId(event.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select a crop
              </option>
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="listing-variety" className="mb-1 block text-sm font-medium text-foreground">
              Variety
            </label>
            <select
              id="listing-variety"
              value={varietyId}
              onChange={(event) => setVarietyId(event.target.value)}
              required
              disabled={!cropId || varieties.length === 0}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                {cropId ? "Select a variety" : "Pick a crop first"}
              </option>
              {varieties.map((variety) => (
                <option key={variety.id} value={variety.id}>
                  {variety.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="retail-price" className="mb-1 block text-sm font-medium text-foreground">
              Retail price (₹/kg)
            </label>
            <input
              id="retail-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={retailPrice}
              onChange={(event) => setRetailPrice(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="wholesale-price" className="mb-1 block text-sm font-medium text-foreground">
              Wholesale price (₹/kg)
            </label>
            <input
              id="wholesale-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={wholesalePrice}
              onChange={(event) => setWholesalePrice(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="min-wholesale-qty" className="mb-1 block text-sm font-medium text-foreground">
              Min wholesale qty (kg)
            </label>
            <input
              id="min-wholesale-qty"
              type="number"
              min="0"
              step="0.01"
              required
              value={minWholesaleQty}
              onChange={(event) => setMinWholesaleQty(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="retail-ceiling" className="mb-1 block text-sm font-medium text-foreground">
              Retail ceiling % (5–20)
            </label>
            <input
              id="retail-ceiling"
              type="number"
              min="5"
              max="20"
              required
              value={retailCeilingPercent}
              onChange={(event) => setRetailCeilingPercent(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="prebookable" className="mb-1 block text-sm font-medium text-foreground">
              Pre-bookable % (50–70)
            </label>
            <input
              id="prebookable"
              type="number"
              min="50"
              max="70"
              required
              value={preBookablePercent}
              onChange={(event) => setPreBookablePercent(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="available-quantity" className="mb-1 block text-sm font-medium text-foreground">
            Available quantity (kg)
          </label>
          <input
            id="available-quantity"
            type="number"
            min="0"
            step="0.01"
            required
            value={availableQuantity}
            onChange={(event) => setAvailableQuantity(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="listing-description" className="mb-1 block text-sm font-medium text-foreground">
            Description (optional)
          </label>
          <textarea
            id="listing-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isOrganicCertified}
            onChange={(event) => setIsOrganicCertified(event.target.checked)}
          />
          Organic certified
        </label>

        <button
          type="submit"
          disabled={isCreating || !cropId || !varietyId}
          className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? "Publishing…" : "Publish listing"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <hr className="my-10 border-border" />

      <h2 className="font-display text-lg font-[650] text-ink">
        Your listings
      </h2>
      <p className="mt-1 text-sm text-muted">
        Includes unpublished drafts (from tracked batches) and closed
        listings. Select one to edit its stock/description or close it.
      </p>

      <div className="mt-4">
        {isLoadingListings ? (
          <p className="text-muted">Loading listings…</p>
        ) : listingsError ? (
          <p role="alert" className="text-sm text-danger-700">
            {listingsError}
          </p>
        ) : listings.length === 0 ? (
          <p className="text-muted">
            No listings yet — create a direct listing above, or set terms on
            a batch that&apos;s reached its final milestone.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {listings.map((listing) => (
              <li key={listing.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-foreground">
                    {listing.variety?.name ?? "—"}
                    {listing.crop?.name && (
                      <span className="text-muted"> · {listing.crop.name}</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    ₹{listing.retailPrice}/kg · {listing.availableQuantity} kg
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    listing.isClosed
                      ? "bg-dark-slate-grey-100 text-dark-slate-grey-800"
                      : listing.isPublished
                        ? "bg-icy-aqua-50 text-primary-text"
                        : "bg-lavender-grey-100 text-lavender-grey-800"
                  }`}
                >
                  {listing.isClosed
                    ? "Closed"
                    : listing.isPublished
                      ? "Live"
                      : "Draft"}
                </span>
                <button
                  type="button"
                  onClick={() => loadIntoEditor(fromAdmin(listing))}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {managed && (
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
          <p className="font-mono text-xs text-muted">ID: {managed.id}</p>
          {managed.retailPrice && (
            <p className="text-sm text-muted">
              Retail ₹{managed.retailPrice}/kg
              {managed.wholesalePrice && ` · Wholesale ₹${managed.wholesalePrice}/kg`}
              {" "}(locked — create a new listing to change pricing)
            </p>
          )}
          <div>
            <label htmlFor="edit-quantity" className="mb-1 block text-sm font-medium text-foreground">
              Available quantity (kg)
            </label>
            <input
              id="edit-quantity"
              type="number"
              min="0"
              step="0.01"
              required
              value={editQuantity}
              onChange={(event) => setEditQuantity(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={3}
              className={INPUT_CLASS}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={editOrganic}
              onChange={(event) => setEditOrganic(event.target.checked)}
            />
            Organic certified
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={isClosing}
              onClick={() => void handleClose()}
              className="rounded-sm border border-danger-700 px-4 py-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-60"
            >
              {isClosing ? "Closing…" : "Close listing"}
            </button>
          </div>
          {editError && (
            <p role="alert" className="text-sm text-danger-700">
              {editError}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
