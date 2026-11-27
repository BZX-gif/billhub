"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, Info, Undo2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createId } from "@/lib/ids";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
  notifyUndo: (message: string, onUndo: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-brand/25 bg-surface",
  error: "border-danger/30 bg-surface",
  warning: "border-amber/30 bg-surface",
  info: "border-line bg-surface",
};

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <Check className="h-4 w-4" aria-hidden="true" />,
  error: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  info: <Info className="h-4 w-4" aria-hidden="true" />,
};

const TONE_ICON_WRAP: Record<ToastTone, string> = {
  success: "bg-brand-soft text-brand-strong",
  error: "bg-danger-soft text-danger",
  warning: "bg-amber-soft text-amber",
  info: "bg-canvas text-ink-soft",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = createId("toast");
      const tone = input.tone ?? "success";
      const duration = input.duration ?? (tone === "error" ? 7000 : 4200);
      setToasts((current) => [...current.slice(-2), { ...input, tone, id }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const notifyUndo = useCallback(
    (message: string, onUndo: () => void) => {
      const id = createId("toast");
      setToasts((current) => [
        ...current.slice(-2),
        {
          id,
          message,
          tone: "success",
          duration: 6000,
          action: { label: "Undo", onClick: () => { onUndo(); dismiss(id); } },
        },
      ]);
      const timer = setTimeout(() => dismiss(id), 6000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((timer) => clearTimeout(timer));
      timersMap.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify, notifyUndo }), [notify, notifyUndo]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-[70] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:left-1/2 sm:right-auto sm:top-4 sm:w-[380px] sm:-translate-x-1/2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "animate-toast pointer-events-auto flex items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-[var(--shadow-lift)]",
              TONE_STYLES[toast.tone ?? "success"],
            )}
            role="status"
          >
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                TONE_ICON_WRAP[toast.tone ?? "success"],
              )}
            >
              {TONE_ICON[toast.tone ?? "success"]}
            </span>
            <p className="min-w-0 flex-1 pt-0.5 text-[13.5px] font-medium leading-snug text-ink">
              {toast.message}
            </p>
            {toast.action ? (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand-strong transition-colors hover:bg-brand-soft"
              >
                <span className="inline-flex items-center gap-1">
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {toast.action.label}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
