"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-400/30 bg-[#0b2318] text-emerald-50",
  error: "border-red-400/30 bg-[#2a0f0f] text-red-50",
  info: "border-sky-400/30 bg-rc-night-lighter text-white",
};

const toneIcons: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const toneIconClasses: Record<ToastTone, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-sky-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Portals are only safe to render after the client has mounted: rendering
  // conditionally on `typeof document` during the render pass itself would
  // make the server and first client render disagree (SSR never has
  // `document`, but the client's *initial* render already does), which
  // trips a hydration mismatch. Gating on a post-mount effect instead keeps
  // both passes identical (nothing) until hydration has settled.
  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timer = setTimeout(() => dismiss(id), 5000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:bottom-3 sm:top-auto sm:items-end sm:pr-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <AnimatePresence>
              {toasts.map((t) => {
                const Icon = toneIcons[t.tone];
                return (
                  <motion.div
                    key={t.id}
                    role="status"
                    layout
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-rc-lg",
                      toneClasses[t.tone],
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", toneIconClasses[t.tone])} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tracking-tight">{t.title}</p>
                        {t.description && <p className="mt-0.5 text-xs opacity-90">{t.description}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        aria-label="Fermer la notification"
                        className="shrink-0 rounded-full p-1 text-current/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
