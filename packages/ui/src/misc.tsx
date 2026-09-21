"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ className, label = "Chargement" }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn("h-5 w-5 animate-spin text-rc-accent", className)}
      role="status"
      aria-label={label}
    />
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const complete = pct >= 100;
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-xs font-medium text-rc-night/70 dark:text-white/65">
          <span>{label}</span>
          <span className="tabular-nums">
            {value}/{max}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-rc-night/10 dark:bg-white/[0.07]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <motion.div
          className={cn("h-full rounded-full", complete ? "bg-rc-success" : "bg-rc-accent")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export interface Tab {
  id: string;
  label: string;
  badge?: number;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const groupId = useId();
  return (
    <div role="tablist" aria-label="Onglets" className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={`${groupId}-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
              selected ? "text-rc-night dark:text-white" : "text-rc-night/60 hover:text-rc-night dark:text-white/55 dark:hover:text-white",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${groupId}-tab-indicator`}
                className="absolute inset-0 rounded-lg bg-white shadow-rc-sm dark:bg-rc-night-lighter"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center">
              {tab.label}
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rc-accent px-1 text-[10px] font-bold text-rc-night">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function CrAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-display font-semibold tabular-nums", className)}>
      {value.toLocaleString("fr-BE")} <span className="text-[0.8em] font-medium opacity-70">CR</span>
    </span>
  );
}
