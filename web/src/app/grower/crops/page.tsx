"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  type Crop,
  createCrop,
  deleteCrop,
  listCrops,
  renameCrop,
} from "@/lib/crops";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function GrowerCropsPage() {
  const { accessToken } = useAuth();

  const [crops, setCrops] = useState<Crop[]>([]);
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
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listCrops(accessToken)
      .then((data) => {
        if (!cancelled) setCrops(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load crops.",
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
    setCreateError(null);
    setIsCreating(true);
    try {
      const crop = await createCrop(accessToken, newName.trim());
      setCrops((prev) => [...prev, crop]);
      setNewName("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create crop.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(crop: Crop) {
    setEditingId(crop.id);
    setEditingName(crop.name);
    setRowError((prev) => ({ ...prev, [crop.id]: "" }));
  }

  async function handleRename(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      const updated = await renameCrop(accessToken, id, editingName.trim());
      setCrops((prev) => prev.map((crop) => (crop.id === id ? updated : crop)));
      setRowError((prev) => ({ ...prev, [id]: "" }));
      setEditingId(null);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't rename crop.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(crop: Crop) {
    if (!accessToken) return;
    if (!window.confirm(`Delete "${crop.name}"? This can't be undone.`)) {
      return;
    }
    setBusyId(crop.id);
    try {
      await deleteCrop(accessToken, crop.id);
      setCrops((prev) => prev.filter((c) => c.id !== crop.id));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [crop.id]:
          err instanceof Error ? err.message : "Couldn't delete crop.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Crops</h1>
      <p className="mt-1 text-muted">
        Crops are the foundation for varieties, cycles, batches, and
        listings.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex gap-3">
        <div className="flex-1">
          <label htmlFor="crop-name" className="sr-only">
            Crop name
          </label>
          <input
            id="crop-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            required
            placeholder="e.g. Tomato"
            className={INPUT_CLASS}
          />
        </div>
        <button
          type="submit"
          disabled={isCreating || newName.trim().length === 0}
          className="shrink-0 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? "Adding…" : "Add crop"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading crops…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : crops.length === 0 ? (
          <p className="text-muted">No crops yet — add your first one above.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {crops.map((crop) => (
              <li key={crop.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {editingId === crop.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      disabled={
                        busyId === crop.id || editingName.trim().length === 0
                      }
                      onClick={() => void handleRename(crop.id)}
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
                    <span className="flex-1 text-foreground">{crop.name}</span>
                    <Link
                      href={`/grower/crops/${crop.id}`}
                      className="text-sm font-medium text-primary-text hover:underline"
                    >
                      Varieties
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEditing(crop)}
                      className="text-sm text-muted hover:text-foreground hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busyId === crop.id}
                      onClick={() => void handleDelete(crop)}
                      className="text-sm text-danger-700 hover:underline disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
                {rowError[crop.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[crop.id]}
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
