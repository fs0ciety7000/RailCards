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
