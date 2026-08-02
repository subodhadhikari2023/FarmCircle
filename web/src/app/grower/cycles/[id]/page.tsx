"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { type CycleWithMilestones, getCycle } from "@/lib/cycles";
import {
  type Milestone,
  createMilestone,
  deleteMilestone,
  updateMilestone,
} from "@/lib/milestones";

const INPUT_CLASS =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

type EditDraft = { name: string; order: string; expectedDurationDays: string };

export default function GrowerCycleMilestonesPage() {
  const { id: cycleId } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [cycle, setCycle] = useState<CycleWithMilestones | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({
    name: "",
    order: "",
    expectedDurationDays: "",
  });
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!accessToken || !cycleId) return;
    setIsLoading(true);
    setLoadError(null);
    getCycle(accessToken, cycleId)
      .then(setCycle)
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load the cycle.",
        );
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is defined inline and stable enough for this page's lifecycle
  }, [accessToken, cycleId]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !cycleId) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const milestone = await createMilestone(accessToken, cycleId, {
        name: newName.trim(),
        order: Number(newOrder),
        expectedDurationDays: Number(newDuration),
      });
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              milestones: [...prev.milestones, milestone].sort(
                (a, b) => a.order - b.order,
              ),
            }
          : prev,
      );
      setNewName("");
      setNewOrder("");
      setNewDuration("");
      toast.show({ variant: "success", title: "Milestone added", message: milestone.name });
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create milestone.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(milestone: Milestone) {
    setEditingId(milestone.id);
    setDraft({
      name: milestone.name,
      order: String(milestone.order),
      expectedDurationDays: String(milestone.expectedDurationDays),
    });
    setRowError((prev) => ({ ...prev, [milestone.id]: "" }));
  }

  async function handleSave(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      const updated = await updateMilestone(accessToken, id, {
        name: draft.name.trim(),
        order: Number(draft.order),
        expectedDurationDays: Number(draft.expectedDurationDays),
      });
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              milestones: prev.milestones
                .map((m) => (m.id === id ? updated : m))
                .sort((a, b) => a.order - b.order),
            }
          : prev,
      );
      setRowError((prev) => ({ ...prev, [id]: "" }));
      setEditingId(null);
      toast.show({ variant: "success", title: "Milestone saved", message: updated.name });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't save milestone.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(milestone: Milestone) {
    if (!accessToken) return;
    const confirmed = await confirm({
      title: `Delete "${milestone.name}"?`,
      message: "This can't be undone.",
      confirmLabel: "Delete milestone",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(milestone.id);
    try {
      await deleteMilestone(accessToken, milestone.id);
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              milestones: prev.milestones.filter((m) => m.id !== milestone.id),
            }
          : prev,
      );
      toast.show({ variant: "success", title: "Milestone deleted", message: milestone.name });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [milestone.id]:
          err instanceof Error ? err.message : "Couldn't delete milestone.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <Link href="/grower/cycles" className="text-sm text-primary-text hover:underline">
        ← All cycles
      </Link>
      <h1 className="mt-2 font-display text-2xl font-[650] text-ink">
        {cycle ? `${cycle.name} — milestones` : "Milestones"}
      </h1>
      <p className="mt-1 text-muted">
        Milestones are steps a Batch progresses through, in order. Editing
        these is safe even after Batches exist — it only affects future
        Batches, not ones already snapshotted.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          required
          placeholder="Milestone name"
          className={INPUT_CLASS}
        />
        <input
          type="number"
          min="1"
          value={newOrder}
          onChange={(event) => setNewOrder(event.target.value)}
          required
          placeholder="Order"
          className={`sm:w-24 ${INPUT_CLASS}`}
        />
        <input
          type="number"
          min="1"
          value={newDuration}
          onChange={(event) => setNewDuration(event.target.value)}
          required
          placeholder="Days"
          className={`sm:w-24 ${INPUT_CLASS}`}
        />
        <button
          type="submit"
          disabled={isCreating || newName.trim().length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {isCreating ? "Adding…" : "Add milestone"}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {createError}
        </p>
      )}

      <div className="mt-10">
        {isLoading ? (
          <p className="text-muted">Loading milestones…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : !cycle || cycle.milestones.length === 0 ? (
          <EmptyState icon="cyclone">
            No milestones yet — add your first one above.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {cycle.milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {editingId === milestone.id ? (
                  <>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <input
                      type="number"
                      min="1"
                      value={draft.order}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, order: event.target.value }))
                      }
                      className={`w-20 ${INPUT_CLASS}`}
                    />
                    <input
                      type="number"
                      min="1"
                      value={draft.expectedDurationDays}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          expectedDurationDays: event.target.value,
                        }))
                      }
                      className={`w-20 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      disabled={busyId === milestone.id}
                      onClick={() => void handleSave(milestone.id)}
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
                      #{milestone.order} — {milestone.name}
                      <span className="ml-2 text-xs text-muted">
                        ~{milestone.expectedDurationDays}d
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditing(milestone)}
                      className="rounded-sm px-2 py-1.5 text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === milestone.id}
                      onClick={() => void handleDelete(milestone)}
                      className="rounded-sm px-2 py-1.5 text-sm text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
                {rowError[milestone.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[milestone.id]}
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
