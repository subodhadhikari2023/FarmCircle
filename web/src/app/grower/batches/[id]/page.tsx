"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import {
  type BatchDetail,
  addActivity,
  advanceMilestone,
  confirmHarvest,
  getBatch,
} from "@/lib/batches-admin";
import { createDraftFromBatch } from "@/lib/listings-admin";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function GrowerBatchDetailPage() {
  const { id: batchId } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const toast = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reachedAt, setReachedAt] = useState(todayIsoDate());
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [hasListingTerms, setHasListingTerms] = useState(false);
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minWholesaleQty, setMinWholesaleQty] = useState("");
  const [retailCeilingPercent, setRetailCeilingPercent] = useState("10");
  const [preBookablePercent, setPreBookablePercent] = useState("60");
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsInfo, setTermsInfo] = useState<string | null>(null);
  const [isSettingTerms, setIsSettingTerms] = useState(false);

  const [actualYield, setActualYield] = useState("");
  const [harvestError, setHarvestError] = useState<string | null>(null);
  const [isConfirmingHarvest, setIsConfirmingHarvest] = useState(false);

  const [note, setNote] = useState("");
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isLoggingActivity, setIsLoggingActivity] = useState(false);

  function reload() {
    if (!accessToken || !batchId) return;
    getBatch(accessToken, batchId)
      .then(setBatch)
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load the batch.",
        );
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is defined inline and stable enough for this page's lifecycle
  }, [accessToken, batchId]);

  const finalOrder = batch
    ? batch.milestoneProgress.reduce(
        (max, progress) => Math.max(max, progress.order),
        0,
      )
    : 0;
  const isAtFinalMilestone = batch
    ? batch.currentMilestoneOrder >= finalOrder
    : false;

  async function handleAdvance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !batchId) return;
    setAdvanceError(null);
    setIsAdvancing(true);
    try {
      await advanceMilestone(accessToken, batchId, reachedAt);
      reload();
      toast.show({ variant: "success", title: "Milestone advanced" });
    } catch (err) {
      setAdvanceError(
        err instanceof Error ? err.message : "Couldn't advance milestone.",
      );
    } finally {
      setIsAdvancing(false);
    }
  }

  async function handleSetTerms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !batchId) return;
    setTermsError(null);
    setTermsInfo(null);
    setIsSettingTerms(true);
    try {
      await createDraftFromBatch(accessToken, batchId, {
        retailPrice: Number(retailPrice),
        wholesalePrice: Number(wholesalePrice),
        minWholesaleQty: Number(minWholesaleQty),
        retailCeilingPercent: Number(retailCeilingPercent),
        preBookablePercent: Number(preBookablePercent),
      });
      setHasListingTerms(true);
      toast.show({ variant: "success", title: "Listing terms set" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't set listing terms.";
      if (message.toLowerCase().includes("already exists")) {
        setHasListingTerms(true);
        setTermsInfo("Listing terms were already set for this batch.");
      } else {
        setTermsError(message);
      }
    } finally {
      setIsSettingTerms(false);
    }
  }

  async function handleConfirmHarvest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !batchId) return;
    setHarvestError(null);
    setIsConfirmingHarvest(true);
    try {
      await confirmHarvest(accessToken, batchId, Number(actualYield));
      reload();
      toast.show({
        variant: "success",
        title: "Harvest confirmed",
        message: "The listing is now live.",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't confirm harvest.";
      if (message.toLowerCase().includes("set listing terms")) {
        setHasListingTerms(false);
      }
      setHarvestError(message);
    } finally {
      setIsConfirmingHarvest(false);
    }
  }

  async function handleLogActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !batchId) return;
    setActivityError(null);
    setIsLoggingActivity(true);
    try {
      const entry = await addActivity(accessToken, batchId, {
        note: note.trim() || undefined,
      });
      setBatch((prev) =>
        prev ? { ...prev, activityLog: [...prev.activityLog, entry] } : prev,
      );
      setNote("");
      toast.show({ variant: "success", title: "Activity logged" });
    } catch (err) {
      setActivityError(
        err instanceof Error ? err.message : "Couldn't log activity.",
      );
    } finally {
      setIsLoggingActivity(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
        <p className="text-muted">Loading batch…</p>
      </main>
    );
  }

  if (loadError || !batch) {
    return (
      <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
        <p role="alert" className="text-sm text-danger-700">
          {loadError ?? "Batch not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <Link href="/grower/batches" className="text-sm text-primary-text hover:underline">
        ← All batches
      </Link>
      <h1 className="mt-2 font-display text-2xl font-[650] text-ink">
        Batch {batch.id.slice(0, 8)}
      </h1>
      <p className="mt-1 text-muted">
        Planted {batch.quantity} kg · predicted yield {batch.predictedYield} kg
        {batch.harvestConfirmed &&
          ` · harvested ${batch.actualYield ?? "?"} kg`}
      </p>

      <h2 className="mt-10 font-display text-lg font-[650] text-ink">
        Milestones
      </h2>
      <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
        {batch.milestoneProgress.map((progress) => (
          <li key={progress.id} className="px-4 py-3">
            <span className="text-foreground">
              #{progress.order} — {progress.milestone.name}
            </span>
            <span className="ml-2 text-xs text-muted">
              {progress.reachedAt
                ? `reached ${new Date(progress.reachedAt).toLocaleDateString()}`
                : "not reached yet"}
            </span>
          </li>
        ))}
      </ul>

      {!batch.harvestConfirmed && !isAtFinalMilestone && (
        <form onSubmit={handleAdvance} className="mt-4 flex items-end gap-3">
          <div>
            <label htmlFor="reached-at" className="mb-1 block text-sm font-medium text-foreground">
              Reached on
            </label>
            <input
              id="reached-at"
              type="date"
              value={reachedAt}
              onChange={(event) => setReachedAt(event.target.value)}
              required
              className={INPUT_CLASS}
            />
          </div>
          <button
            type="submit"
            disabled={isAdvancing}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isAdvancing ? "Advancing…" : "Advance to next milestone"}
          </button>
        </form>
      )}
      {advanceError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {advanceError}
        </p>
      )}

      {!batch.harvestConfirmed && isAtFinalMilestone && (
        <>
          <h2 className="mt-10 font-display text-lg font-[650] text-ink">
            Set listing terms
          </h2>
          <p className="mt-1 text-sm text-muted">
            This batch has reached its final milestone. Set terms to create a
            draft listing — confirming harvest below then publishes it.
          </p>
          <form onSubmit={handleSetTerms} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="terms-retail-price" className="mb-1 block text-sm font-medium text-foreground">
                  Retail price (₹/kg)
                </label>
                <input
                  id="terms-retail-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={retailPrice}
                  onChange={(event) => setRetailPrice(event.target.value)}
                  className={INPUT_CLASS}
                  disabled={hasListingTerms}
                />
              </div>
              <div>
                <label htmlFor="terms-wholesale-price" className="mb-1 block text-sm font-medium text-foreground">
                  Wholesale price (₹/kg)
                </label>
                <input
                  id="terms-wholesale-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={wholesalePrice}
                  onChange={(event) => setWholesalePrice(event.target.value)}
                  className={INPUT_CLASS}
                  disabled={hasListingTerms}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="terms-min-wholesale-qty" className="mb-1 block text-sm font-medium text-foreground">
                  Min wholesale qty (kg)
                </label>
                <input
                  id="terms-min-wholesale-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={minWholesaleQty}
                  onChange={(event) => setMinWholesaleQty(event.target.value)}
                  className={INPUT_CLASS}
                  disabled={hasListingTerms}
                />
              </div>
              <div>
                <label htmlFor="terms-retail-ceiling" className="mb-1 block text-sm font-medium text-foreground">
                  Retail ceiling % (5–20)
                </label>
                <input
                  id="terms-retail-ceiling"
                  type="number"
                  min="5"
                  max="20"
                  required
                  value={retailCeilingPercent}
                  onChange={(event) => setRetailCeilingPercent(event.target.value)}
                  className={INPUT_CLASS}
                  disabled={hasListingTerms}
                />
              </div>
              <div>
                <label htmlFor="terms-prebookable" className="mb-1 block text-sm font-medium text-foreground">
                  Pre-bookable % (50–70)
                </label>
                <input
                  id="terms-prebookable"
                  type="number"
                  min="50"
                  max="70"
                  required
                  value={preBookablePercent}
                  onChange={(event) => setPreBookablePercent(event.target.value)}
                  className={INPUT_CLASS}
                  disabled={hasListingTerms}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSettingTerms || hasListingTerms}
              className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {hasListingTerms
                ? "Terms set"
                : isSettingTerms
                  ? "Saving…"
                  : "Set listing terms"}
            </button>
          </form>
          {termsError && (
            <p role="alert" className="mt-2 text-sm text-danger-700">
              {termsError}
            </p>
          )}
          {termsInfo && <p className="mt-2 text-sm text-muted">{termsInfo}</p>}

          <h2 className="mt-10 font-display text-lg font-[650] text-ink">
            Confirm harvest
          </h2>
          <form onSubmit={handleConfirmHarvest} className="mt-4 flex items-end gap-3">
            <div>
              <label htmlFor="actual-yield" className="mb-1 block text-sm font-medium text-foreground">
                Actual yield (kg)
              </label>
              <input
                id="actual-yield"
                type="number"
                min="0"
                step="0.01"
                required
                value={actualYield}
                onChange={(event) => setActualYield(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <button
              type="submit"
              disabled={isConfirmingHarvest}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isConfirmingHarvest ? "Confirming…" : "Confirm harvest"}
            </button>
          </form>
          {harvestError && (
            <p role="alert" className="mt-2 text-sm text-danger-700">
              {harvestError}
            </p>
          )}
        </>
      )}

      <h2 className="mt-10 font-display text-lg font-[650] text-ink">
        Activity log
      </h2>
      <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
        {batch.activityLog.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No notes yet.</li>
        ) : (
          batch.activityLog.map((entry) => (
            <li key={entry._id} className="px-4 py-3">
              <p className="text-sm text-foreground">{entry.note}</p>
              <p className="text-xs text-muted">
                {new Date(entry.loggedAt).toLocaleString()}
              </p>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={handleLogActivity} className="mt-4 flex gap-3">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Log a quick note…"
          required
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={isLoggingActivity}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            note_add
          </span>
          {isLoggingActivity ? "Logging…" : "Log"}
        </button>
      </form>
      {activityError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {activityError}
        </p>
      )}
    </main>
  );
}
