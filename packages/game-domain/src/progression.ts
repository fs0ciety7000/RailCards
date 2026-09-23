/**
 * Triangular XP curve: level n requires cumulative XP of 100 * n*(n+1)/2.
 * Level 1 -> 0 XP, level 2 -> 200 XP, level 3 -> 600 XP, level 10 -> 5500 XP…
 * Deliberately simple and easy to tune later; kept as pure functions so the
 * curve can be unit tested and reused by both API and worker.
 */
export const MAX_LEVEL = 100;

export function xpThresholdForLevel(level: number): number {
  const n = level - 1;
  return 100 * (n * (n + 1) / 2);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpThresholdForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function xpToNextLevel(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  const level = levelForXp(xp);
  const currentThreshold = xpThresholdForLevel(level);
  const nextThreshold = xpThresholdForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - currentThreshold,
    xpForNextLevel: nextThreshold - currentThreshold,
  };
}

/**
 * Grade ladder, themed after the Belgian railway hierarchy a player
 * "climbs" as they play. Levels are split into 10 tiers up to MAX_LEVEL;
 * kept as a simple sorted array (rather than a formula) so titles can be
 * tuned freely without touching the XP curve above.
 */
export const GRADES: ReadonlyArray<{ minLevel: number; title: string }> = [
  { minLevel: 1, title: "Apprenti aiguilleur" },
  { minLevel: 5, title: "Voyageur régulier" },
  { minLevel: 10, title: "Contrôleur" },
  { minLevel: 20, title: "Chef de bord" },
  { minLevel: 30, title: "Conducteur" },
  { minLevel: 40, title: "Chef de gare adjoint" },
  { minLevel: 50, title: "Chef de gare" },
  { minLevel: 65, title: "Inspecteur du réseau" },
  { minLevel: 80, title: "Directeur régional" },
  { minLevel: 95, title: "Légende du rail" },
];

/**
 * Effective member cap for a guild at a given level: the base cap plus one
 * extra slot per GUILD_LEVEL_SLOTS_TIER_SIZE levels, capped at
 * GUILD_LEVEL_MAX_EXTRA_SLOTS extra slots total.
 */
export function guildMaxMembers(level: number, baseMax: number, slotsTierSize: number, maxExtraSlots: number): number {
  const extraSlots = Math.min(maxExtraSlots, Math.floor((level - 1) / slotsTierSize));
  return baseMax + extraSlots;
}

export function gradeForLevel(level: number): string {
  let title = GRADES[0]!.title;
  for (const grade of GRADES) {
    if (level < grade.minLevel) break;
    title = grade.title;
  }
  return title;
}
