"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Gem, Sparkles, Star, TrainFront } from "lucide-react";
import { cn } from "@railcards/ui";
import type { BoosterCategory } from "@/lib/types";

export type PackPhase = "idle" | "shaking" | "burst";

const CATEGORY_THEME: Record<BoosterCategory, { from: string; to: string; glow: string }> = {
  DISCOVERY: { from: "#3FA0E8", to: "#1B4F87", glow: "#2E7DD1" },
  CLASSIC: { from: "#FFD763", to: "#E0A800", glow: "#FFC72C" },
  THEMED: { from: "#C793F7", to: "#7C4FC7", glow: "#B47CF0" },
};

/**
 * The pack's die-cut foil-pouch silhouette: a zigzag heat-seal top melting
 * into a rounded body, plus a dashed "tear here" seam just below the seal.
 * Kept as a standalone path (not text/icons) so it reads instantly as a
 * physical pack rather than a generic card.
 */
const PACK_PATH =
  "M 10 42 L 32 14 L 54 36 L 76 12 L 98 34 L 110 10 L 122 34 L 144 12 L 166 36 L 188 14 L 210 42" +
  " L 210 268 Q 210 286 192 286 L 28 286 Q 10 286 10 268 Z";

function PackSilhouette({ gradientId, glow }: { gradientId: string; glow: string }) {
  const clipId = `${gradientId}-clip`;
  return (
    <svg viewBox="0 0 220 300" className="h-full w-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--pack-from)" />
          <stop offset="100%" stopColor="var(--pack-to)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-glare`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={PACK_PATH} />
        </clipPath>
      </defs>
      <path d={PACK_PATH} fill={`url(#${gradientId})`} stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
      <g clipPath={`url(#${clipId})`}>
        <line x1="16" y1="50" x2="204" y2="50" stroke="rgba(255,255,255,0.4)" strokeDasharray="5 5" strokeWidth={1.5} />
        <rect x="-10" y="0" width="46" height="300" fill={`url(#${gradientId}-glare)`} transform="rotate(18 110 150)" opacity={0.6} />
      </g>
      <circle cx="110" cy="176" r="46" fill="rgba(6,10,20,0.35)" stroke={glow} strokeWidth={2} strokeOpacity={0.7} />
    </svg>
  );
}

function FloatingAccents({ glow }: { glow: string }) {
  const accents = useMemo(
    () => [
      { Icon: Sparkles, top: "6%", left: "-6%", delay: 0, size: 18 },
      { Icon: Gem, top: "62%", left: "94%", delay: 0.4, size: 16 },
      { Icon: Star, top: "80%", left: "-4%", delay: 0.8, size: 14 },
      { Icon: Sparkles, top: "18%", left: "96%", delay: 1.2, size: 12 },
    ],
    [],
  );
  return (
    <>
      {accents.map(({ Icon, top, left, delay, size }, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute"
          style={{ top, left, color: glow }}
          aria-hidden="true"
          animate={{ y: [0, -10, 0], opacity: [0.35, 0.9, 0.35], rotate: [0, 8, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <Icon width={size} height={size} strokeWidth={1.75} />
        </motion.span>
      ))}
    </>
  );
}

/**
 * The unopened-pack visual: an SVG foil pouch, colored by booster category,
 * with a floating idle bob, a "shaking" wind-up before it's torn open, and a
 * "burst" flash+scale-out once the pull has actually resolved server-side.
 * `phase` is driven by the opening flow in the boosters page — this
 * component itself has no async/API awareness.
 */
export function BoosterPackArt({
  category,
  phase = "idle",
  className,
}: {
  category: BoosterCategory;
  phase?: PackPhase;
  className?: string;
}) {
  const theme = CATEGORY_THEME[category];
  const prefersReduced = useReducedMotion();
  const gradientId = `pack-gradient-${category}`;

  const packAnimation =
    phase === "shaking"
      ? { x: [0, -7, 7, -6, 6, -3, 3, 0], rotate: [0, -3, 3, -2, 2, -1, 1, 0], scale: 1 }
      : phase === "burst"
        ? { scale: [1, 1.12, 0.2], opacity: [1, 1, 0], rotate: 0 }
        : prefersReduced
          ? { y: 0 }
          : { y: [0, -10, 0], rotate: [0, -1, 0, 1, 0] };
  const packTransition =
    phase === "shaking"
      ? { duration: 0.5, ease: "easeInOut" as const }
      : phase === "burst"
        ? { duration: 0.5, ease: "easeIn" as const }
        : { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div className={cn("relative mx-auto aspect-[11/15] w-full max-w-[220px]", className)}>
      <div
        className="animate-pulse-glow absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${theme.glow}66, transparent 72%)` }}
        aria-hidden="true"
      />
      {!prefersReduced && phase === "idle" && <FloatingAccents glow={theme.glow} />}
      {phase === "burst" && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 rounded-full bg-white"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0.3, 1.6, 2.1] }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      )}
      <motion.div
        className="relative h-full w-full"
        style={{ ["--pack-from" as string]: theme.from, ["--pack-to" as string]: theme.to }}
        animate={packAnimation}
        transition={packTransition}
      >
        <PackSilhouette gradientId={gradientId} glow={theme.glow} />
        <div className="pointer-events-none absolute left-1/2 top-[58%] flex h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-rc-night/60" style={{ borderColor: theme.glow }}>
          <TrainFront className="h-1/2 w-1/2" style={{ color: theme.glow }} strokeWidth={2.25} aria-hidden="true" />
        </div>
      </motion.div>
    </div>
  );
}
