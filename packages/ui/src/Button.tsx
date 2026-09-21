"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

// motion.button's own event props (onDrag, onAnimationStart, …) collide in
// type with the plain DOM ones from ButtonHTMLAttributes — omit them here
// since this component doesn't expose drag/animation-lifecycle callbacks.
type ConflictingHandlers = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingHandlers> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, icon, fullWidth, disabled, children, ...props },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={isDisabled ? undefined : { scale: 1.015 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-tight transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-rc-night",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </motion.button>
  );
});
