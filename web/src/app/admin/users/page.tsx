"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  type ManagedUser,
  listUsers,
  reactivateUser,
  suspendUser,
} from "@/lib/users";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listUsers(accessToken)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load accounts.",
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

  async function handleToggleSuspend(user: ManagedUser) {
    if (!accessToken) return;
    if (!user.isSuspended) {
      const confirmed = await confirm({
        title: `Suspend ${user.name}?`,
        message: "This blocks their sign-in immediately. You can reactivate the account at any time.",
        confirmLabel: "Suspend account",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!confirmed) return;
    }
    setBusyId(user.id);
    try {
      const updated = user.isSuspended
        ? await reactivateUser(accessToken, user.id)
        : await suspendUser(accessToken, user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setRowError((prev) => ({ ...prev, [user.id]: "" }));
      toast.show({
        variant: "success",
        title: updated.isSuspended ? "Account suspended" : "Account reactivated",
        message: updated.name,
      });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [user.id]:
          err instanceof Error ? err.message : "Couldn't update the account.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex-1 max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-[650] text-ink">Users</h1>
      <p className="mt-1 text-muted">
        Vendor and Customer accounts. Suspending blocks sign-in without
        deleting the account.
      </p>

      <div className="mt-10">
        {isLoading ? (
          <ListSkeleton />
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger-700">
            {loadError}
          </p>
        ) : users.length === 0 ? (
          <EmptyState icon="group">No Vendor or Customer accounts yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <p className="font-[650] text-foreground">{user.name}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                </div>
                <span className="rounded-full bg-dark-slate-grey-100 px-2 py-0.5 text-xs font-medium text-dark-slate-grey-800">
                  {user.role}
                </span>
                {user.isSuspended && (
                  <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
                    Suspended
                  </span>
                )}
                <button
                  type="button"
                  disabled={busyId === user.id}
                  onClick={() => void handleToggleSuspend(user)}
                  className={`rounded-sm border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background disabled:opacity-60 ${
                    user.isSuspended ? "text-foreground" : "text-danger-700"
                  }`}
                >
                  {busyId === user.id
                    ? "Saving…"
                    : user.isSuspended
                      ? "Reactivate"
                      : "Suspend"}
                </button>
                {rowError[user.id] && (
                  <p role="alert" className="w-full text-xs text-danger-700">
                    {rowError[user.id]}
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
