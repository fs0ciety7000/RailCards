"use client";

import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { Gem, Sparkles } from "lucide-react";
import { cn, RarityBadge } from "@railcards/ui";
import { combatGradeForStats, type CombatGradeInfo } from "@railcards/game-domain";
import { parseCombatStats } from "@/components/CombatStatsPanel";
import type { CardDefinition, Rarity } from "@/lib/types";

/**
 * Card rarity, staged as a "material quality" ladder (1 Commune → 6
 * Mythique). This is a real card layout — outer frame, name plate, art
 * window, rarity footer — not just a bordered photo, so the frame reads
 * clearly at every tier instead of disappearing behind full-bleed art.
 * Shared by CardTile (grids), CardArt (detail/market) and BoosterReveal so
 * a Mythique pull looks the same kind of special everywhere it appears.
 */
function tierOf(order: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.min(6, Math.max(1, Math.round(order))) as 1 | 2 | 3 | 4 | 5 | 6;
}

interface FrameSpec {
  thickness: string;
  holo: boolean;
  frameStyle: (hex: string) => React.CSSProperties;
  plateStyle: (hex: string) => React.CSSProperties;
}

const NEUTRAL_FRAME = "linear-gradient(155deg, #6b7486, #454d5e 38%, #313847 62%, #545d70)";

const FRAME_BY_TIER: Record<1 | 2 | 3 | 4 | 5 | 6, FrameSpec> = {
  1: {
    thickness: "p-[3px]",
    holo: false,
    frameStyle: () => ({ background: NEUTRAL_FRAME, boxShadow: "0 6px 16px -10px rgba(0,0,0,0.7)" }),
    plateStyle: () => ({ background: "rgba(10, 14, 24, 0.82)" }),
  },
  2: {
    thickness: "p-[3px]",
    holo: false,
    frameStyle: (hex) => ({
      background: `linear-gradient(155deg, color-mix(in srgb, ${hex} 55%, white) 0%, ${hex} 35%, color-mix(in srgb, ${hex} 60%, black) 65%, ${hex})`,
      boxShadow: `0 6px 16px -9px ${hex}70`,
    }),
    plateStyle: (hex) => ({ background: `linear-gradient(90deg, ${hex}30, rgba(10,14,24,0.85) 55%)` }),
  },
  3: {
    thickness: "p-[4px]",
    holo: false,
    frameStyle: (hex) => ({
      background: `linear-gradient(155deg, color-mix(in srgb, ${hex} 65%, white) 0%, ${hex} 32%, color-mix(in srgb, ${hex} 55%, black) 68%, ${hex})`,
      boxShadow: `0 8px 20px -8px ${hex}90`,
    }),
    plateStyle: (hex) => ({ background: `linear-gradient(90deg, ${hex}40, rgba(10,14,24,0.85) 55%)` }),
  },
  4: {
    thickness: "p-[5px]",
    holo: false,
    frameStyle: (hex) => ({
      background: `linear-gradient(155deg, var(--color-holo-gold) -10%, color-mix(in srgb, ${hex} 70%, white) 22%, ${hex} 48%, color-mix(in srgb, ${hex} 55%, black) 72%, ${hex})`,
      boxShadow: `0 10px 26px -8px ${hex}a0, 0 0 24px -10px rgba(255, 215, 102, 0.4)`,
    }),
    plateStyle: (hex) => ({ background: `linear-gradient(90deg, ${hex}55, rgba(10,14,24,0.88) 60%)` }),
  },
  5: {
    thickness: "p-[6px] motion-safe:animate-pulse-glow",
    holo: false,
    frameStyle: (hex) => ({
      background: `linear-gradient(155deg, var(--color-holo-gold) 0%, ${hex} 30%, color-mix(in srgb, ${hex} 40%, black) 55%, var(--color-holo-gold) 80%, ${hex})`,
      boxShadow: `0 14px 32px -8px ${hex}b0, 0 0 42px -8px rgba(255, 215, 102, 0.6)`,
    }),
    plateStyle: (hex) => ({ background: `linear-gradient(90deg, rgba(255,215,102,0.4), rgba(10,14,24,0.88) 60%)` , borderColor: hex}),
  },
  6: {
    thickness: "p-[6px] motion-safe:animate-pulse-glow",
    holo: true,
    frameStyle: (hex) => ({ boxShadow: `0 16px 38px -6px ${hex}c0, 0 0 56px -8px rgba(77, 234, 240, 0.6)` }),
    plateStyle: () => ({ background: "linear-gradient(90deg, rgba(180,124,240,0.35), rgba(10,14,24,0.88) 60%)" }),
  },
};

const SPARKLE_SPOTS: [number, number][] = [
  [14, 24], [82, 14], [46, 34], [88, 62], [18, 70], [64, 84],
];

function holoConicGradient(hex: string) {
  return `conic-gradient(from 0deg, var(--color-holo-gold), var(--color-holo-magenta), var(--color-holo-violet), var(--color-holo-cyan), ${hex}, var(--color-holo-gold))`;
}

function SparkleField({ tier }: { tier: number }) {
  const count = tier >= 6 ? 6 : tier === 5 ? 4 : 3;
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

/** Small ornamental corner pips — a classic TCG frame cue — shown at Épique+. */
function CornerPips({ hex }: { hex: string }) {
  const pip = (pos: string) => (
    <span
      aria-hidden="true"
      className={cn("absolute z-20 h-[7px] w-[7px] rotate-45", pos)}
      style={{ background: hex, boxShadow: `0 0 6px ${hex}` }}
    />
  );
  return (
    <>
      {pip("left-1 top-1")}
      {pip("right-1 top-1")}
    </>
  );
}

export interface CardFaceData {
  name: string;
  rarity: Rarity;
  imageUrl: string;
  /** A card's overall combat-stat grade (S/A/B/C/D), shown as a small badge distinct from the rarity footer — omitted for cards without combat stats. */
  combatGrade?: CombatGradeInfo | null;
  /** A hand-minted signature instance — "N/M" numbering scoped to this card's own signature mints, shown as a corner ribbon. */
  signature?: { number: number; edition: number } | null;
}

function isPlaceholderArt(imageUrl: string): boolean {
  return imageUrl.startsWith("/card-placeholders/");
}

/**
 * The rarity SVG used as a decorative art-window border/matte behind a
 * real photo — the same file the API falls back to as a card's `imageUrl`
 * when no real photo has been set (see `placeholderImageUrl` in
 * prisma/seed.ts), keyed off the rarity code rather than the card's own
 * (possibly real-photo) imageUrl.
 */
function placeholderArtUrl(rarityCode: string): string {
  return `/card-placeholders/${rarityCode.toLowerCase()}.svg`;
}

/**
 * The full card face: thick tiered frame → name plate → art window → rarity
 * footer. A cursor-tracked tilt + moving glare sweep on top (skipped under
 * prefers-reduced-motion); the ambient pulse/holo-spin are plain CSS
 * animations already muted globally for reduced motion in globals.css.
 */
export function CardFrame({
  card,
  className,
  priority,
  foil,
}: {
  card: CardFaceData;
  className?: string;
  priority?: boolean;
  /** Cosmetic holo/foil variant (CardInstance.isFoil) — reuses the Mythique holo-spin treatment regardless of rarity tier. No stat effect. */
  foil?: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const tier = tierOf(card.rarity.order);
  const frame = FRAME_BY_TIER[tier];
  const hex = card.rarity.colorHex;
  const showHoloSpin = frame.holo || foil;

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 300, damping: 22, mass: 0.6 });
  const springY = useSpring(rotateY, { stiffness: 300, damping: 22, mass: 0.6 });
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.5), transparent 55%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 12);
    rotateX.set((0.5 - py) * 12);
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
      className={cn("relative rounded-2xl", className)}
      style={{
        perspective: 800,
        // A combat grade adds its own thin colored ring, drawn outside the
        // rarity frame's own border — a second, independent border so the
        // two gradings never get confused with one another. Lives on this
        // outer wrapper (not the frame div below) because that one clips
        // its own box-shadow via overflow-hidden.
        ...(card.combatGrade
          ? { boxShadow: `0 0 0 2px ${card.combatGrade.colorHex}, 0 6px 16px -10px ${card.combatGrade.colorHex}90` }
          : {}),
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative h-full w-full"
        style={prefersReduced ? undefined : { rotateX: springX, rotateY: springY }}
      >
        {/* Outer frame: the thick tiered border that makes this read as a card, not a photo.
            overflow-hidden clips the Mythique holo-spin overlay below (it deliberately
            extends past the card body for a soft glow) to the card's own rounded rect —
            without it, the overlay bleeds across the entire page. */}
        <div className={cn("relative h-full w-full overflow-hidden rounded-2xl", frame.thickness)} style={frame.frameStyle(hex)}>
          {card.signature && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[-34%] top-[13%] z-30 w-[170%] -rotate-45 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 py-[3px] text-center text-[9.5px] font-extrabold uppercase tracking-wide text-black shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            >
              Signature Nº{card.signature.number}/{card.signature.edition}
            </div>
          )}
          {showHoloSpin && (
            <div
              aria-hidden="true"
              className="motion-safe:animate-holo-spin pointer-events-none absolute -inset-[60%] opacity-95"
              style={{ background: holoConicGradient(hex) }}
            />
          )}
          {tier >= 4 && <CornerPips hex={hex} />}

          {/* Card body */}
          <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-[13px] bg-rc-night-light">
            {/* Name plate */}
            <div
              className="relative z-20 shrink-0 border-b px-2 py-1.5"
              style={{ ...frame.plateStyle(hex), borderColor: `${hex}40` }}
            >
              <p className="font-display truncate text-[11.5px] font-bold leading-tight text-white sm:text-[13px]">
                {card.name}
              </p>
            </div>

            {/* Art window */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {isPlaceholderArt(card.imageUrl) ? (
                <Image
                  src={card.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, 260px"
                  className="object-cover"
                  unoptimized
                  priority={priority}
                />
              ) : (
                <>
                  {/* Rarity SVG as a decorative border/matte around the real photo. */}
                  <Image
                    src={placeholderArtUrl(card.rarity.code)}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 45vw, 260px"
                    className="object-cover"
                    unoptimized
                    aria-hidden="true"
                  />
                  <div className="absolute inset-[9%] overflow-hidden rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.5)] ring-1 ring-white/15">
                    <Image
                      src={card.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 40vw, 230px"
                      className="object-cover"
                      unoptimized
                      priority={priority}
                    />
                  </div>
                </>
              )}
              {tier >= 4 && <SparkleField tier={tier} />}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent"
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[6] mix-blend-overlay"
                style={{ background: glareBackground, opacity: glareOpacity }}
              />
            </div>

            {/* Rarity footer */}
            <div
              className="relative z-20 flex shrink-0 items-center gap-1.5 border-t px-2 py-1.5"
              style={{ background: "rgba(8, 11, 20, 0.9)", borderColor: `${hex}40` }}
            >
              {tier >= 5 ? (
                <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: hex }} aria-hidden="true" />
              ) : (
                <Gem className="h-3.5 w-3.5 shrink-0" style={{ color: hex }} aria-hidden="true" />
              )}
              <span className="truncate text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: hex }}>
                {card.rarity.label}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {foil && (
                  <span
                    className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-black"
                    style={{ background: holoConicGradient(hex) }}
                  >
                    Foil
                  </span>
                )}
                {card.combatGrade && (
                  <span
                    className="rounded-full border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide"
                    style={{ borderColor: card.combatGrade.colorHex, color: card.combatGrade.colorHex }}
                    title={card.combatGrade.label}
                  >
                    {card.combatGrade.grade}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CardArt({
  card,
  className,
  priority,
  foil,
  signature,
}: {
  card: CardDefinition;
  className?: string;
  priority?: boolean;
  foil?: boolean;
  /** Instance-level numbered signature (CardInstance.isSignature/signatureNumber/signatureEdition) — not on the card definition, so passed separately (mirrors `foil`). */
  signature?: { number: number; edition: number } | null;
}) {
  const stats = card.combatStatsEnabled ? parseCombatStats(card.combatStats) : null;
  return (
    <CardFrame
      card={{
        name: card.name,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        combatGrade: stats ? combatGradeForStats(stats) : null,
        signature,
      }}
      className={className ?? "relative aspect-[3/4] w-full"}
      priority={priority}
      foil={foil}
    />
  );
}

export function CardTile({
  instanceId,
  card,
  state,
  href,
  count,
  foil,
  signature,
}: {
  instanceId: string;
  card: CardDefinition;
  state?: string;
  href?: string;
  /** How many owned copies this tile stacks for (duplicates shown as one tile + a "×N" badge instead of repeating). */
  count?: number;
  foil?: boolean;
  signature?: { number: number; edition: number } | null;
}) {
  const content = (
    <div className="group relative">
      <CardArt card={card} className="relative aspect-[3/4] w-full" foil={foil} signature={signature} />
      {count && count > 1 && (
        <span className="pointer-events-none absolute left-1.5 top-9 z-30 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
          ×{count}
        </span>
      )}
      {state && state !== "AVAILABLE" && (
        <span className="pointer-events-none absolute right-1.5 top-9 z-30 max-w-[80%] truncate rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[9px] font-semibold text-white/80 backdrop-blur-sm">
          {stateLabel(state)}
        </span>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      aria-label={`${card.name}, ${card.rarity.label}${instanceId ? "" : ""}`}
    >
      {content}
    </Link>
  );
}

/**
 * A dense, single-line alternative to CardTile for scanning a large
 * collection quickly — same instance-level data (foil/signature/count/
 * state, plus the combat grade), just laid out as a row instead of a full
 * card face.
 */
export function CardListRow({
  card,
  state,
  href,
  count,
  foil,
  signature,
}: {
  card: CardDefinition;
  state?: string;
  href?: string;
  count?: number;
  foil?: boolean;
  signature?: { number: number; edition: number } | null;
}) {
  const hex = card.rarity.colorHex;
  const stats = card.combatStatsEnabled ? parseCombatStats(card.combatStats) : null;
  const grade = stats ? combatGradeForStats(stats) : null;

  const content = (
    <div className="group flex items-center gap-3 rounded-xl border border-rc-border bg-rc-night-light px-3 py-2 transition-colors hover:border-rc-border-strong hover:bg-rc-night-lighter">
      <div
        className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10"
        style={grade ? { boxShadow: `0 0 0 1.5px ${grade.colorHex}` } : undefined}
      >
        <Image src={card.imageUrl} alt="" fill sizes="44px" className="object-cover" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{card.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RarityBadge label={card.rarity.label} colorHex={hex} size="sm" />
          {foil && (
            <span
              className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-black"
              style={{ background: holoConicGradient(hex) }}
            >
              Foil
            </span>
          )}
          {signature && (
            <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-amber-300">
              Nº{signature.number}/{signature.edition}
            </span>
          )}
          {grade && (
            <span
              className="rounded-full border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide"
              style={{ borderColor: grade.colorHex, color: grade.colorHex }}
              title={grade.label}
            >
              {grade.grade}
            </span>
          )}
          {state && state !== "AVAILABLE" && <span className="text-[10px] text-white/40">{stateLabel(state)}</span>}
        </div>
      </div>
      {count && count > 1 && (
        <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-xs font-bold text-white">×{count}</span>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent">
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
