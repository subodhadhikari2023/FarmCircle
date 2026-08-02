"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { type Crop, listCrops } from "@/lib/crops";
import { type Variety, listVarieties } from "@/lib/varieties";
import { type Cycle, listCycles } from "@/lib/cycles";
import { type Batch, createBatch, listBatches } from "@/lib/batches-admin";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function GrowerBatchesPage() {
  const { accessToken } = useAuth();
  const toast = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cropId, setCropId] = useState("");
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [varietyId, setVarietyId] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [predictedYield, setPredictedYield] = useState("");

  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([listBatches(accessToken), listCrops(accessToken)])
      .then(([batchData, cropData]) => {
        if (!cancelled) {
          setBatches(batchData);
          setCrops(cropData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load batches.",
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

  useEffect(() => {
    if (!accessToken || !cropId) return;
    let cancelled = false;
    Promise.all([
      listVarieties(accessToken, cropId),
      listCycles(accessToken, cropId),
    ])
      .then(([varietyData, cycleData]) => {
        if (cancelled) return;
        setVarieties(varietyData);
        setVarietyId("");
        setCycles(cycleData);
        setCycleId("");
      })
      .catch(() => {
        if (!cancelled) {
          setVarieties([]);
          setCycles([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, cropId]);

  function cropName(id: string) {
    return crops.find((crop) => crop.id === id)?.name ?? id;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const batch = await createBatch(accessToken, {
        cropId,
        varietyId,
        cycleId,
        quantity: Number(quantity),
        predictedYield: Number(predictedYield),
      });
      setBatches((prev) => [...prev, batch]);
      setQuantity("");
      setPredictedYield("");
      toast.show({ variant: "success", title: "Batch started" });
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't start batch.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Batches</h1>
      <p className="mt-1 text-muted">
        Start a tracked batch against a Crop, Variety, and Cycle. Once it
        reaches its final milestone, you can set listing terms and confirm
        harvest.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={cropId}
            onChange={(event) => setCropId(event.target.value)}
            required
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              Crop
            </option>
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
          <select
            value={varietyId}
            onChange={(event) => setVarietyId(event.target.value)}
            required
            disabled={!cropId || varieties.length === 0}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              {cropId ? "Variety" : "Pick a crop first"}
            </option>
            {varieties.map((variety) => (
              <option key={variety.id} value={variety.id}>
                {variety.name}
              </option>
            ))}
          </select>
          <select
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
            required
            disabled={!cropId || cycles.length === 0}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              {cropId ? "Cycle" : "Pick a crop first"}
            </option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="batch-quantity" className="mb-1 block text-sm font-medium text-foreground">
              Quantity planted (kg)
            </label>
            <input
              id="batch-quantity"
              type="number"
              min="0"
              step="0.01"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="batch-yield" className="mb-1 block text-sm font-medium text-foreground">
              Predicted yield (kg)
            </label>
            <input
              id="batch-yield"
              type="number"
              min="0"
              step="0.01"
              required
              value={predictedYield}
              onChange={(event) => setPredictedYield(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isCreating || !cropId || !varietyId || !cycleId}
          className="flex items-center gap-1.5 self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {isCreating ? "Starting…" : "Start batch"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading batches…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : batches.length === 0 ? (
          <EmptyState icon="inventory_2">No batches yet — start one above.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {batches.map((batch) => (
              <li key={batch.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <span className="text-foreground">{cropName(batch.cropId)}</span>
                  <span className="ml-2 text-xs text-muted">
                    milestone #{batch.currentMilestoneOrder}
                    {batch.harvestConfirmed && " · harvested"}
                  </span>
                </div>
                <Link
                  href={`/grower/batches/${batch.id}`}
                  className="text-sm font-medium text-primary-text hover:underline"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
