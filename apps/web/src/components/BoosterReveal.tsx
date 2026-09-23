"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button, staggerContainer, fadeInUp } from "@railcards/ui";
import { CardFrame } from "@/components/CardTile";
import type { BoosterPull } from "@/lib/types";

/**
 * A burst of small sparks flying outward from the card center on reveal —
 * richer for higher tiers so a mythic pull visibly outshines a rare one,
 * not just a bigger blob of the same soft gradient.
 */
function RarityBurst({ order, colorHex }: { order: number; colorHex: string }) {
  const isMythic = order >= 6;
  const particleCount = isMythic ? 16 : order >= 5 ? 11 : 7;
  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 55 + Math.random() * 45;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          delay: Math.random() * 0.18,
          duration: 0.7 + Math.random() * 0.35,
          size: isMythic ? 4 + Math.random() * 3 : 3 + Math.random() * 2,
          color: isMythic ? (i % 2 === 0 ? "#FFD766" : "#4DEAF0") : colorHex,
        };
      }),
    // particleCount and isMythic are derived from `order`, the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, colorHex],
  );

  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden="true">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

export function BoosterReveal({
  pulls,
  reduceMotion,
  onReduceMotionChange,
}: {
  pulls: BoosterPull[];
  reduceMotion: boolean;
  onReduceMotionChange: (v: boolean) => void;
}) {
  const [revealedCount, setRevealedCount] = useState(reduceMotion ? pulls.length : 0);
  const allRevealed = revealedCount >= pulls.length;

  function revealAll() {
    setRevealedCount(pulls.length);
  }

  function revealNext() {
    setRevealedCount((c) => Math.min(pulls.length, c + 1));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-white/60">
          {allRevealed ? "Toutes les cartes sont révélées." : `${revealedCount} / ${pulls.length} révélée(s)`}
        </p>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => {
              onReduceMotionChange(e.target.checked);
              if (e.target.checked) revealAll();
            }}
            className="h-4 w-4 rounded border-white/30 accent-[var(--color-rc-accent)]"
          />
          Passer l&apos;animation
        </label>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        {pulls.map((pull, i) => {
          const isRevealed = i < revealedCount;
          return (
            <motion.button
              key={pull.id}
              variants={fadeInUp}
              type="button"
              onClick={() => {
                if (!isRevealed) revealNext();
              }}
              disabled={isRevealed}
              className="group relative rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent disabled:cursor-default"
              aria-label={isRevealed ? `${pull.cardDefinition.name}, ${pull.cardDefinition.rarity.label}` : "Révéler la carte"}
            >
              {isRevealed && !reduceMotion && pull.cardDefinition.rarity.order >= 4 && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-6 z-0 rounded-full"
                  initial={{ opacity: 0.9, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  style={{
                    background:
                      pull.cardDefinition.rarity.order >= 6
                        ? "radial-gradient(circle, rgba(255,215,102,0.55), rgba(77,234,240,0.35) 45%, transparent 72%)"
                        : `radial-gradient(circle, ${pull.cardDefinition.rarity.colorHex}77, transparent 70%)`,
                  }}
                />
              )}
              {isRevealed && !reduceMotion && pull.cardDefinition.rarity.order >= 4 && (
                <RarityBurst order={pull.cardDefinition.rarity.order} colorHex={pull.cardDefinition.rarity.colorHex} />
              )}
              <AnimatePresence mode="wait" initial={false}>
                {isRevealed ? (
                  <motion.div
                    key="face"
                    initial={reduceMotion ? false : { rotateY: 90, opacity: 0, scale: 0.85 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
                    className="relative z-10"
                  >
                    <CardFrame
                      card={{
                        name: pull.cardDefinition.name,
                        rarity: pull.cardDefinition.rarity,
                        imageUrl: pull.cardDefinition.imageUrl,
                      }}
                      className="relative aspect-[3/4] w-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="back"
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.03 }}
                    className="relative z-10 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-rc-night-lighter to-rc-night-dark shadow-rc-md"
                  >
                    <span
                      className="font-display rounded-xl border border-white/10 px-3 py-1.5 text-xl font-bold tracking-tight text-rc-accent/70"
                      aria-hidden="true"
                    >
                      RC
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              {!isRevealed && <p className="relative z-10 mt-2 text-center text-xs text-white/40">Toucher pour révéler</p>}
            </motion.button>
          );
        })}
      </motion.div>

      {!allRevealed && (
        <Button variant="outline" className="mt-4" onClick={revealAll}>
          Tout révéler
        </Button>
      )}
    </div>
  );
}
