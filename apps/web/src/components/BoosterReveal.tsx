"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Button, RarityBadge } from "@railcards/ui";
import type { BoosterPull } from "@/lib/types";

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {pulls.map((pull, i) => {
          const isRevealed = i < revealedCount;
          return (
            <button
              key={pull.id}
              type="button"
              onClick={() => {
                if (!isRevealed) revealNext();
              }}
              disabled={isRevealed}
              className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent disabled:cursor-default"
              aria-label={isRevealed ? `${pull.cardDefinition.name}, ${pull.cardDefinition.rarity.label}` : "Révéler la carte"}
            >
              <div
                className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border"
                style={{ borderColor: isRevealed ? `${pull.cardDefinition.rarity.colorHex}88` : "rgba(255,255,255,0.15)" }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isRevealed ? (
                    <motion.div
                      key="face"
                      initial={reduceMotion ? false : { rotateY: 90, opacity: 0, scale: 0.85 }}
                      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <Image src={pull.cardDefinition.imageUrl} alt="" fill sizes="220px" className="object-cover" unoptimized />
                      {!reduceMotion && (pull.cardDefinition.rarity.order >= 4) && (
                        <motion.div
                          className="pointer-events-none absolute inset-0"
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.8 }}
                          style={{ background: `radial-gradient(circle, ${pull.cardDefinition.rarity.colorHex}66, transparent 70%)` }}
                        />
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="back"
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-rc-night-light"
                    >
                      <span className="font-display text-2xl font-bold text-rc-accent/70" aria-hidden="true">
                        RC
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-2 min-h-10">
                {isRevealed ? (
                  <>
                    <p className="truncate text-sm font-semibold text-white">{pull.cardDefinition.name}</p>
                    <RarityBadge label={pull.cardDefinition.rarity.label} colorHex={pull.cardDefinition.rarity.colorHex} size="sm" />
                  </>
                ) : (
                  <p className="text-xs text-white/40">Toucher pour révéler</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!allRevealed && (
        <Button variant="outline" className="mt-4" onClick={revealAll}>
          Tout révéler
        </Button>
      )}
    </div>
  );
}
