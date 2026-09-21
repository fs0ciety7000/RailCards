import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "success" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "bg-rc-night/10 text-rc-night dark:bg-white/10 dark:text-white",
    accent: "bg-rc-accent/20 text-rc-accent-dark dark:text-rc-accent",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-red-500/15 text-red-700 dark:text-red-300",
    info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Rarity is never conveyed by color alone: this badge always pairs the
 * API-provided `colorHex` swatch with its text `label`.
 */
export function RarityBadge({
  label,
  colorHex,
  size = "md",
  className,
}: {
  label: string;
  colorHex: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{
        borderColor: `${colorHex}55`,
        backgroundColor: `${colorHex}1a`,
        color: colorHex,
      }}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
      />
      {label}
    </span>
  );
}
