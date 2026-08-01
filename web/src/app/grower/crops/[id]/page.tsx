"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { type Crop, getCrop } from "@/lib/crops";
import {
  type Variety,
  createVariety,
  deleteVariety,
  listVarieties,
  renameVariety,
} from "@/lib/varieties";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function GrowerCropVarietiesPage() {
  const { id: cropId } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const [crop, setCrop] = useState<Crop | null>(null);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !cropId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getCrop(accessToken, cropId), listVarieties(accessToken, cropId)])
      .then(([cropData, varietyData]) => {
        if (!cancelled) {
          setCrop(cropData);
          setVarieties(varietyData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load varieties.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, cropId]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !cropId) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const variety = await createVariety(accessToken, cropId, newName.trim());
      setVarieties((prev) => [...prev, variety]);
      setNewName("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create variety.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(variety: Variety) {
    setEditingId(variety.id);
    setEditingName(variety.name);
    setRowError((prev) => ({ ...prev, [variety.id]: "" }));
  }

  async function handleRename(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      const updated = await renameVariety(accessToken, id, editingName.trim());
      setVarieties((prev) =>
        prev.map((variety) => (variety.id === id ? updated : variety)),
      );
      setRowError((prev) => ({ ...prev, [id]: "" }));
      setEditingId(null);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't rename variety.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(variety: Variety) {
    if (!accessToken) return;
    if (!window.confirm(`Delete "${variety.name}"? This can't be undone.`)) {
      return;
    }
    setBusyId(variety.id);
    try {
      await deleteVariety(accessToken, variety.id);
      setVarieties((prev) => prev.filter((v) => v.id !== variety.id));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [variety.id]:
          err instanceof Error ? err.message : "Couldn't delete variety.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <Link href="/grower/crops" className="text-sm text-primary-text hover:underline">
        ← All crops
      </Link>
      <h1 className="mt-2 font-display text-2xl font-[650] text-ink">
        {crop ? `${crop.name} — varieties` : "Varieties"}
      </h1>
      <p className="mt-1 text-muted">
        Varieties are what batches and listings are created against.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex gap-3">
        <div className="flex-1">
          <label htmlFor="variety-name" className="sr-only">
            Variety name
          </label>
          <input
            id="variety-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            required
            placeholder="e.g. Roma"
            className={INPUT_CLASS}
          />
        </div>
        <button
          type="submit"
          disabled={isCreating || newName.trim().length === 0}
          className="shrink-0 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? "Adding…" : "Add variety"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading varieties…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : varieties.length === 0 ? (
          <p className="text-muted">
            No varieties yet — add your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {varieties.map((variety) => (
              <li
                key={variety.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {editingId === variety.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      disabled={
                        busyId === variety.id ||
                        editingName.trim().length === 0
                      }
                      onClick={() => void handleRename(variety.id)}
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
                    <span className="flex-1 text-foreground">
                      {variety.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditing(variety)}
                      className="text-sm text-muted hover:text-foreground hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busyId === variety.id}
                      onClick={() => void handleDelete(variety)}
                      className="text-sm text-danger-700 hover:underline disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
                {rowError[variety.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[variety.id]}
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
