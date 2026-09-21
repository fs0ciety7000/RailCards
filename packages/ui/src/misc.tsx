"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Spinner({ className, label = "Chargement" }: { className?: string; label?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 animate-spin text-rc-accent", className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs font-medium text-rc-night/70 dark:text-white/70">
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-rc-night/10 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="h-full rounded-full bg-rc-accent transition-all duration-500" style={{ width: `${pct}%` }} />
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
    <div role="tablist" aria-label="Onglets" className="flex gap-1 rounded-xl bg-rc-night/5 p-1 dark:bg-white/5">
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
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
              selected
                ? "bg-white text-rc-night shadow dark:bg-rc-night-light dark:text-white"
                : "text-rc-night/60 hover:text-rc-night dark:text-white/60 dark:hover:text-white",
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rc-accent px-1 text-[10px] font-bold text-rc-night">
                {tab.badge}
              </span>
            )}
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
    <span className={cn("font-mono font-bold tabular-nums", className)}>
      {value.toLocaleString("fr-BE")} <span className="font-sans text-[0.8em] font-semibold opacity-70">CR</span>
    </span>
  );
}
