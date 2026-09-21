"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { cn } from "./cn";
import { fadeInUp } from "./motion";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeInUp}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-rc-night/15 bg-rc-night-light/40 px-6 py-14 text-center dark:border-rc-border-strong",
        className,
      )}
    >
      {icon && (
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-white/50 [&_svg]:h-6 [&_svg]:w-6"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-base font-semibold tracking-tight text-rc-night dark:text-white">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-rc-night/60 dark:text-white/55">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({
  title = "Une erreur est survenue",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeInUp}
      className="flex flex-col items-center justify-center rounded-2xl border border-rc-danger/25 bg-rc-danger/[0.06] px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rc-danger/15 text-rc-danger" aria-hidden="true">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold tracking-tight text-rc-danger">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-rc-night/70 dark:text-white/70">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
