"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { Gem, Sparkles } from "lucide-react";
import { RarityBadge, cn } from "@railcards/ui";
import type { CardDefinition, Rarity } from "@/lib/types";

/**
 * Card rarity, staged as a "material quality" ladder (1 Commune → 6
 * Mythique): a flat neutral border at the bottom, up through a foil-style
 * rotating holographic frame at the top. Shared by CardTile (grids),
 * CardArt (detail/market) and BoosterReveal so a Mythique pull looks the
 * same kind of special everywhere it appears.
 */
function tierOf(order: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.min(6, Math.max(1, Math.round(order))) as 1 | 2 | 3 | 4 | 5 | 6;
}

interface FrameSpec {
  padded: boolean;
  holo: boolean;
  wrapperClassName: string;
  wrapperStyle: (hex: string) => React.CSSProperties;
}

const FRAME_BY_TIER: Record<1 | 2 | 3 | 4 | 5 | 6, FrameSpec> = {
  1: {
    padded: false,
    holo: false,
    wrapperClassName: "border border-rc-border-strong",
    wrapperStyle: () => ({}),
  },
  2: {
    padded: false,
    holo: false,
    wrapperClassName: "border",
    wrapperStyle: (hex) => ({ borderColor: `${hex}55`, boxShadow: `0 0 0 1px ${hex}14` }),
  },
  3: {
    padded: false,
    holo: false,
    wrapperClassName: "border",
    wrapperStyle: (hex) => ({ borderColor: `${hex}90`, boxShadow: `0 6px 18px -9px ${hex}80` }),
  },
  4: {
    padded: true,
    holo: false,
    wrapperClassName: "p-[2px]",
    wrapperStyle: (hex) => ({
      background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 45%, white), ${hex})`,
      boxShadow: `0 8px 24px -8px ${hex}80`,
    }),
  },
  5: {
    padded: true,
    holo: false,
    wrapperClassName: "p-[2px] motion-safe:animate-pulse-glow",
    wrapperStyle: (hex) => ({
      background: `linear-gradient(135deg, var(--color-holo-gold), ${hex}, var(--color-holo-gold))`,
      boxShadow: `0 10px 30px -8px ${hex}99, 0 0 38px -10px rgba(255, 215, 102, 0.55)`,
    }),
  },
  6: {
    padded: true,
    holo: true,
    wrapperClassName: "overflow-hidden p-[2.5px] motion-safe:animate-pulse-glow",
    wrapperStyle: (hex) => ({
      boxShadow: `0 12px 34px -6px ${hex}aa, 0 0 48px -8px rgba(77, 234, 240, 0.5)`,
    }),
  },
};

const SPARKLE_SPOTS: [number, number][] = [
  [14, 20],
  [80, 12],
  [46, 30],
  [88, 58],
  [18, 66],
  [62, 82],
  [34, 92],
  [92, 88],
];

function holoConicGradient(hex: string) {
  return `conic-gradient(from 0deg, var(--color-holo-gold), var(--color-holo-magenta), var(--color-holo-violet), var(--color-holo-cyan), ${hex}, var(--color-holo-gold))`;
}

function SparkleField({ tier }: { tier: number }) {
  const count = tier >= 6 ? 8 : tier === 5 ? 5 : 3;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true">
      {SPARKLE_SPOTS.slice(0, count).map(([x, y], i) => (
        <span
          key={i}
          className="motion-safe:animate-sparkle absolute h-[3px] w-[3px] rounded-full bg-white"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.28}s` }}
        />
      ))}
    </div>
  );
}

function RarityGem({ rarity, tier }: { rarity: Rarity; tier: number }) {
  const Icon = tier >= 5 ? Sparkles : Gem;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute right-1.5 top-1.5 z-20 flex items-center justify-center rounded-full border backdrop-blur-sm",
        tier >= 4 ? "h-6 w-6" : "h-5 w-5",
      )}
      style={{
        backgroundColor: "rgba(6, 10, 20, 0.55)",
        borderColor: `${rarity.colorHex}55`,
      }}
    >
      <Icon className={tier >= 4 ? "h-3.5 w-3.5" : "h-3 w-3"} style={{ color: rarity.colorHex }} />
    </span>
  );
}

/**
 * The interactive card surface: rarity-tiered frame + ambient glow, a
 * cursor-tracked tilt with a moving glare sweep, and (tier 4+) a sprinkle of
 * twinkling sparkles. Tilt/glare are skipped under prefers-reduced-motion
 * (via `useReducedMotion`); the ambient glow/pulse/holo-spin are plain CSS
 * animations already muted globally for reduced motion in globals.css.
 */
export function CardFrame({
  rarity,
  className,
  children,
}: {
  rarity: Rarity;
  className?: string;
  children: ReactNode;
}) {
  const prefersReduced = useReducedMotion();
  const tier = tierOf(rarity.order);
  const frame = FRAME_BY_TIER[tier];

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 300, damping: 22, mass: 0.6 });
  const springY = useSpring(rotateY, { stiffness: 300, damping: 22, mass: 0.6 });
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.55), transparent 55%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 14);
    rotateX.set((0.5 - py) * 14);
    glareX.set(px * 100);
    glareY.set(py * 100);
  }

  function handleMouseEnter() {
    if (!prefersReduced) glareOpacity.set(1);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glareOpacity.set(0);
  }

  return (
    <div
      className={cn("relative", className)}
      style={{ perspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative h-full w-full"
        style={prefersReduced ? undefined : { rotateX: springX, rotateY: springY }}
      >
        <div
          className={cn("relative h-full w-full rounded-2xl", frame.wrapperClassName)}
          style={frame.wrapperStyle(rarity.colorHex)}
        >
          {frame.holo && (
            <div
              aria-hidden="true"
              className="motion-safe:animate-holo-spin pointer-events-none absolute -inset-[60%] opacity-90"
              style={{ background: holoConicGradient(rarity.colorHex) }}
            />
          )}
          <div
            className={cn(
              "relative z-10 h-full w-full overflow-hidden bg-rc-night-light",
              frame.padded ? "rounded-[14px]" : "rounded-2xl",
            )}
          >
            {children}
            {tier >= 4 && <SparkleField tier={tier} />}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[6] mix-blend-overlay"
              style={{ background: glareBackground, opacity: glareOpacity }}
            />
          </div>
        </div>
      </motion.div>
      <RarityGem rarity={rarity} tier={tier} />
    </div>
  );
}

export function CardArt({
  card,
  className,
  priority,
}: {
  card: CardDefinition;
  className?: string;
  priority?: boolean;
}) {
  return (
    <CardFrame rarity={card.rarity} className={className ?? "relative aspect-[3/4] w-full"}>
      <Image
        src={card.imageUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 45vw, 220px"
        className="object-cover"
        unoptimized
        priority={priority}
      />
    </CardFrame>
  );
}

export function CardTile({
  instanceId,
  card,
  state,
  href,
}: {
  instanceId: string;
  card: CardDefinition;
  state?: string;
  href?: string;
}) {
  const content = (
    <>
      <CardArt card={card} className="relative aspect-[3/4] w-full transition-transform duration-200" />
      <div className="mt-2.5 space-y-1">
        <p className="font-display truncate text-sm font-semibold text-white">{card.name}</p>
        <div className="flex items-center justify-between gap-1">
          <RarityBadge label={card.rarity.label} colorHex={card.rarity.colorHex} size="sm" />
          {state && state !== "AVAILABLE" && (
            <span className="truncate text-[10px] font-medium text-white/45">{stateLabel(state)}</span>
          )}
        </div>
      </div>
    </>
  );

  if (!href) {
    return <div>{content}</div>;
  }

  return (
    <Link
      href={href}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      aria-label={`${card.name}, ${card.rarity.label}${instanceId ? "" : ""}`}
    >
      {content}
    </Link>
  );
}

export function stateLabel(state: string): string {
  switch (state) {
    case "RESERVED_TRADE":
      return "Réservée (échange)";
    case "RESERVED_MARKET":
      return "En vente";
    case "ARCHIVED":
      return "Archivée";
    default:
      return state;
  }
}
