"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastInput = {
  variant?: ToastVariant;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number; variant: ToastVariant };

type ToastContextValue = {
  show: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning",
  info: "info",
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-success-100 text-success-700",
  error: "bg-danger-50 text-danger-700",
  warning: "bg-warning-100 text-warning-800",
  info: "bg-frosted-blue-50 text-frosted-blue-800",
};

const DEFAULT_DURATION_MS = 5000;

// Soft ink-tinted elevation instead of a generic black drop-shadow, in
// keeping with docs/FarmCircle-Design-System.md's elevation guidance —
// adapted from "brand glow on primary/active elements" to "brand-neutral
// ink glow" here since a toast/dialog is a transient overlay, not a CTA.
const ELEVATION_SHADOW =
  "0 16px 32px -12px color-mix(in srgb, var(--color-dark-slate-grey-900) 22%, transparent), 0 4px 10px -4px color-mix(in srgb, var(--color-dark-slate-grey-900) 14%, transparent)";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = idRef.current++;
      const variant = input.variant ?? "success";
      setToasts((prev) => [...prev, { ...input, id, variant }]);
      const timer = setTimeout(
        () => dismiss(id),
        input.durationMs ?? DEFAULT_DURATION_MS,
      );
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-in pointer-events-auto flex w-full items-start gap-3 rounded-md border border-border bg-surface p-4 sm:max-w-sm"
            style={{ boxShadow: ELEVATION_SHADOW }}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${VARIANT_CLASSES[toast.variant]}`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {VARIANT_ICON[toast.variant]}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-sm text-muted">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-muted transition-colors hover:text-foreground"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
