"use client";

import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { motion } from "motion/react";
import { cn } from "./cn";

type ConflictingHandlers = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd";
type DivProps = Omit<HTMLAttributes<HTMLDivElement>, ConflictingHandlers>;

export interface CardProps extends DivProps {
  /** Adds a hover lift + glow border — use on cards that are themselves interactive
   * (wrapped in a Link/button) or that visually invite a click. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-2xl border border-rc-night/10 bg-white shadow-rc-sm",
        "dark:border-rc-border dark:bg-rc-night-light",
        interactive &&
          "cursor-pointer transition-[border-color,box-shadow] duration-200 hover:border-rc-accent/40 hover:shadow-rc-md",
        className,
      )}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    />
  );
});

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-rc-night/10 p-4 dark:border-rc-border", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
