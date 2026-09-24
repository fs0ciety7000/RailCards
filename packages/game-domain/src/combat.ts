/**
 * A card's overall "power grade" — a single at-a-glance rating derived
 * from its three combat stats (each 0-100, see admin.dto.ts's
 * CombatStatsDto), shown as a border/badge on the card face. Purely
 * cosmetic/informational: duels themselves still compare one specific
 * stat at a time, never this aggregate.
 */

export interface CombatStats {
  power: number;
  reliability: number;
  charm: number;
}

export type CombatGrade = "S" | "A" | "B" | "C" | "D";

export interface CombatGradeInfo {
  grade: CombatGrade;
  label: string;
  colorHex: string;
}

const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: CombatGrade; label: string; colorHex: string }> = [
  { min: 240, grade: "S", label: "Grade S", colorHex: "#F4C531" },
  { min: 180, grade: "A", label: "Grade A", colorHex: "#E0473B" },
  { min: 120, grade: "B", label: "Grade B", colorHex: "#9B4FE0" },
  { min: 60, grade: "C", label: "Grade C", colorHex: "#2E7DD1" },
  { min: 0, grade: "D", label: "Grade D", colorHex: "#6B7486" },
];

/** Sum of the three stats, 0-300. */
export function combatPowerScore(stats: CombatStats): number {
  return stats.power + stats.reliability + stats.charm;
}

export function combatGradeForStats(stats: CombatStats): CombatGradeInfo {
  const score = combatPowerScore(stats);
  const tier = GRADE_THRESHOLDS.find((t) => score >= t.min)!;
  return { grade: tier.grade, label: tier.label, colorHex: tier.colorHex };
}
