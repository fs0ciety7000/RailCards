"use client";

import { motion } from "motion/react";
import { Heart, ShieldCheck, Zap } from "lucide-react";
import { Card, CardBody } from "@railcards/ui";

export interface CombatStats {
  power: number;
  reliability: number;
  charm: number;
}

export function parseCombatStats(value: unknown): CombatStats | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.power !== "number" || typeof v.reliability !== "number" || typeof v.charm !== "number") return null;
  return { power: v.power, reliability: v.reliability, charm: v.charm };
}

const STAT_META = [
  { key: "power" as const, label: "Puissance", icon: Zap },
  { key: "reliability" as const, label: "Fiabilité", icon: ShieldCheck },
  { key: "charm" as const, label: "Charme", icon: Heart },
];

/** A premium, rarity-tinted stat panel — glow border, gradient fill bars. */
export function CombatStatsPanel({ stats, colorHex }: { stats: CombatStats; colorHex: string }) {
  return (
    <Card className="relative mt-4 overflow-hidden border-white/10" style={{ boxShadow: `0 0 30px -14px ${colorHex}a0` }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: `radial-gradient(circle at 15% -20%, ${colorHex}40, transparent 60%)` }}
      />
      <CardBody className="relative space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Statistiques</p>
        {STAT_META.map(({ key, label, icon: Icon }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-white/80">
                <Icon className="h-3.5 w-3.5" style={{ color: colorHex }} aria-hidden="true" />
                {label}
              </span>
              <span className="font-bold text-white">{stats[key]}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${colorHex}aa, ${colorHex})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, stats[key]))}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
