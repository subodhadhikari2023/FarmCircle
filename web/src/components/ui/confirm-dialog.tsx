"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmTone = "default" | "danger";

type ConfirmInput = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmInput & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (input: ConfirmInput) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const ELEVATION_SHADOW =
  "0 24px 48px -16px color-mix(in srgb, var(--color-dark-slate-grey-900) 30%, transparent), 0 8px 16px -8px color-mix(in srgb, var(--color-dark-slate-grey-900) 18%, transparent)";

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...input, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    confirmButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state, close]);

  const tone = state?.tone ?? "default";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-dark-slate-grey-950)_45%,transparent)] p-6"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={state.message ? "confirm-dialog-message" : undefined}
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-6"
            style={{ boxShadow: ELEVATION_SHADOW }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {tone === "danger" && (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-700"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                </span>
              )}
              <div className="min-w-0">
                <h2 id="confirm-dialog-title" className="text-lg text-ink">
                  {state.title}
                </h2>
                {state.message && (
                  <p id="confirm-dialog-message" className="mt-1.5 text-sm text-muted">
                    {state.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-sm px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => close(true)}
                className={`rounded-sm px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${
                  tone === "danger"
                    ? "bg-danger-700 text-white"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  return ctx.confirm;
}
