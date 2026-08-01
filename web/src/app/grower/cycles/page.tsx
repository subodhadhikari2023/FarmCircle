"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { type Crop, listCrops } from "@/lib/crops";
import {
  type Cycle,
  createCycle,
  deleteCycle,
  listCycles,
  renameCycle,
} from "@/lib/cycles";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function GrowerCyclesPage() {
  const { accessToken } = useAuth();

  const [crops, setCrops] = useState<Crop[]>([]);
  const [filterCropId, setFilterCropId] = useState("");

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newCropId, setNewCropId] = useState("");
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listCrops(accessToken)
      .then(setCrops)
      .catch(() => setCrops([]));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listCycles(accessToken, filterCropId || undefined)
      .then((data) => {
        if (!cancelled) setCycles(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load cycles.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, filterCropId]);

  function cropName(cropId: string) {
    return crops.find((crop) => crop.id === cropId)?.name ?? cropId;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const cycle = await createCycle(accessToken, newCropId, newName.trim());
      if (!filterCropId || filterCropId === cycle.cropId) {
        setCycles((prev) => [...prev, cycle]);
      }
      setNewName("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create cycle.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(cycle: Cycle) {
    setEditingId(cycle.id);
    setEditingName(cycle.name);
    setRowError((prev) => ({ ...prev, [cycle.id]: "" }));
  }

  async function handleRename(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      const updated = await renameCycle(accessToken, id, editingName.trim());
      setCycles((prev) =>
        prev.map((cycle) => (cycle.id === id ? updated : cycle)),
      );
      setRowError((prev) => ({ ...prev, [id]: "" }));
      setEditingId(null);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't rename cycle.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(cycle: Cycle) {
    if (!accessToken) return;
    if (!window.confirm(`Delete "${cycle.name}"? This can't be undone.`)) {
      return;
    }
    setBusyId(cycle.id);
    try {
      await deleteCycle(accessToken, cycle.id);
      setCycles((prev) => prev.filter((c) => c.id !== cycle.id));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [cycle.id]:
          err instanceof Error ? err.message : "Couldn't delete cycle.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Cycles</h1>
      <p className="mt-1 text-muted">
        Cycles are milestone templates — start a Batch from one to track it
        through growth.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <select
          value={newCropId}
          onChange={(event) => setNewCropId(event.target.value)}
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
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          required
          placeholder="Cycle name, e.g. Standard 90-day"
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={isCreating || !newCropId || newName.trim().length === 0}
          className="shrink-0 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? "Adding…" : "Add cycle"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <div className="mt-8">
        <label htmlFor="filter-crop" className="mb-1 block text-sm font-medium text-foreground">
          Filter by crop
        </label>
        <select
          id="filter-crop"
          value={filterCropId}
          onChange={(event) => setFilterCropId(event.target.value)}
          className={`max-w-xs ${INPUT_CLASS}`}
        >
          <option value="">All crops</option>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-muted">Loading cycles…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : cycles.length === 0 ? (
          <p className="text-muted">No cycles yet — add your first one above.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {cycles.map((cycle) => (
              <li
                key={cycle.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {editingId === cycle.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      disabled={
                        busyId === cycle.id || editingName.trim().length === 0
                      }
                      onClick={() => void handleRename(cycle.id)}
                      className="text-sm font-medium text-primary-text hover:underline disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-sm text-muted hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-foreground">{cycle.name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {cropName(cycle.cropId)}
                      </span>
                    </div>
                    <Link
                      href={`/grower/cycles/${cycle.id}`}
                      className="text-sm font-medium text-primary-text hover:underline"
                    >
                      Milestones
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEditing(cycle)}
                      className="text-sm text-muted hover:text-foreground hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busyId === cycle.id}
                      onClick={() => void handleDelete(cycle)}
                      className="text-sm text-danger-700 hover:underline disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
                {rowError[cycle.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[cycle.id]}
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
