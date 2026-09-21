import type { Transition, Variants } from "motion/react";

/**
 * Shared motion language for RailCards: a handful of consistent enter /
 * stagger variants, reused across pages instead of every screen inventing
 * its own timings. `MotionConfig reducedMotion="user"` (set once in
 * apps/web/src/app/providers.tsx) makes every consumer of these
 * automatically honor prefers-reduced-motion, so call sites don't need to
 * branch on it themselves.
 */

export const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
};

/** Stagger container: put on the parent, `fadeInUp` (or similar) on children. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
};

/** Slightly slower stagger for a small number of larger elements (cards, sections). */
export const staggerContainerSlow: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.03 },
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};
