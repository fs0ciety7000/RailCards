"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeInUp, staggerContainer } from "@railcards/ui";

/**
 * Wrap a grid/list with `<Stagger>` and each child with `<StaggerItem>` to
 * get a consistent staggered entrance (collection grid, market listings,
 * missions list, …) instead of everything popping in at once. Respects
 * prefers-reduced-motion via the app-wide `MotionConfig` in providers.tsx.
 */
export function Stagger({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div variants={fadeInUp} className={className}>
      {children}
    </motion.div>
  );
}
