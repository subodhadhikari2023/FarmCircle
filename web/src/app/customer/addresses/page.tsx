"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type Address,
  createAddress,
  listAddresses,
} from "@/lib/addresses";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function CustomerAddressesPage() {
  const { accessToken } = useAuth();
  const toast = useToast();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addressText, setAddressText] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Location isn't available in this browser.");
      return;
    }
    setLocateError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setLocateError(
          "Couldn't get your location — allow location access, or enter coordinates manually below.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listAddresses(accessToken)
      .then((data) => {
        if (!cancelled) setAddresses(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load addresses.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      setCreateError("Enter valid coordinates.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      const address = await createAddress(accessToken, {
        addressText: addressText.trim(),
        landmark: landmark.trim() || undefined,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      });
      setAddresses((prev) => [address, ...prev]);
      setAddressText("");
      setLandmark("");
      setLatitude("");
      setLongitude("");
      toast.show({
        variant: "success",
        title: "Address added",
        message: "It's ready to pick next time you check out with delivery.",
      });
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't add address.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">
        Delivery addresses
      </h1>
      <p className="mt-1 text-muted">
        Add an address here so it&apos;s ready to pick when you check out
        with delivery.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="address-text" className="mb-1 block text-sm font-medium text-foreground">
            Address
          </label>
          <input
            id="address-text"
            value={addressText}
            onChange={(event) => setAddressText(event.target.value)}
            required
            placeholder="House no., street, area, city"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="address-landmark" className="mb-1 block text-sm font-medium text-foreground">
            Landmark (optional)
          </label>
          <input
            id="address-landmark"
            value={landmark}
            onChange={(event) => setLandmark(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Coordinates</span>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={isLocating}
              className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                my_location
              </span>
              {isLocating ? "Locating…" : "Use my current location"}
            </button>
          </div>
          {locateError && (
            <p role="alert" className="mt-1.5 text-xs text-danger-700">
              {locateError}
            </p>
          )}
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="address-latitude" className="mb-1 block text-sm font-medium text-foreground">
                Latitude
              </label>
              <input
                id="address-latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                required
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="e.g. 12.9716"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="address-longitude" className="mb-1 block text-sm font-medium text-foreground">
                Longitude
              </label>
              <input
                id="address-longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                required
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="e.g. 77.5946"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              info
            </span>
            Or find them on{" "}
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary-text hover:underline"
            >
              Google Maps
            </a>{" "}
            — long-press (or right-click) a spot to see its coordinates.
          </p>
        </div>
        {createError && (
          <p role="alert" className="text-sm text-danger-700">
            {createError}
          </p>
        )}
        <button
          type="submit"
          disabled={isCreating || addressText.trim().length === 0}
          className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? "Adding…" : "Add address"}
        </button>
      </form>

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading addresses…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : addresses.length === 0 ? (
          <EmptyState icon="location_on">
            No addresses yet — add your first one above.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {addresses.map((address) => (
              <li key={address.id} className="px-4 py-3">
                <p className="text-foreground">{address.addressText}</p>
                {address.landmark && (
                  <p className="text-sm text-muted">
                    Near {address.landmark}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
