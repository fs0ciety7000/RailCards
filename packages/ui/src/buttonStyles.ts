// Button styling, kept out of the "use client" Button module so Server
// Components (e.g. app/not-found.tsx) can style a next/link as a button.
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-rc-accent text-rc-night hover:bg-rc-accent-light active:bg-rc-accent-dark shadow-rc-sm disabled:bg-rc-accent/40 disabled:shadow-none",
  secondary:
    "bg-rc-night-lighter text-white hover:bg-rc-surface-3 active:bg-rc-night-light border border-rc-border-strong shadow-rc-xs disabled:opacity-40",
  outline:
    "bg-transparent text-rc-night dark:text-white border border-rc-night/20 dark:border-rc-border-strong hover:bg-rc-night/5 dark:hover:bg-white/[0.06] disabled:opacity-40",
  ghost:
    "bg-transparent text-rc-night dark:text-white hover:bg-rc-night/5 dark:hover:bg-white/[0.06] disabled:opacity-40",
  danger: "bg-rc-danger text-white hover:brightness-110 active:brightness-95 shadow-rc-sm disabled:opacity-40 disabled:shadow-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-base px-6 py-3 rounded-xl gap-2",
};

const baseClasses = cn(
  "inline-flex items-center justify-center font-semibold tracking-tight transition-colors duration-150",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-rc-night",
  "disabled:cursor-not-allowed",
);

/** Same look as <Button>, for elements that must stay links (e.g. next/link). */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], fullWidth && "w-full", className);
}
