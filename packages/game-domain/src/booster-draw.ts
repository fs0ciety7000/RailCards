/**
 * Pure, deterministic-given-rng booster draw algorithm.
 *
 * This is the single source of truth for "what cards come out of a
 * booster". It never runs on the client — the API calls it inside a DB
 * transaction and persists the result. Keeping it pure (no I/O) makes it
 * trivial to unit test the probability distribution without a database.
 */

export interface RarityWeightEntry {
  rarityId: string;
  rarityCode: string;
  weight: number;
}

export interface BoosterPoolResolved {
  /** Rarity weights that apply to this booster pool version. */
  rarityWeights: RarityWeightEntry[];
  /** Eligible published card definition ids, grouped by rarityId. */
  cardsByRarityId: Record<string, string[]>;
}

export interface DrawnCard {
  rarityId: string;
  rarityCode: string;
  cardDefinitionId: string;
}

import { randomInt } from "node:crypto";

export type RandomFn = () => number; // returns a float in [0, 1)

export function defaultSecureRandom(): number {
  // CSPRNG-backed; maps to [0,1) with 2^32 buckets.
  return randomInt(0, 4294967295) / 4294967295;
}

/**
 * Picks one rarity according to weights, excluding any rarity that has
 * zero eligible cards (so a booster never "misfires" into an empty rarity
 * bucket because the catalog is thin).
 */
export function pickWeightedRarity(
  pool: BoosterPoolResolved,
  rng: RandomFn,
): RarityWeightEntry {
  const eligible = pool.rarityWeights.filter(
    (r) => (pool.cardsByRarityId[r.rarityId]?.length ?? 0) > 0 && r.weight > 0,
  );
  if (eligible.length === 0) {
    throw new Error("Booster pool has no eligible cards for any rarity");
  }
  const totalWeight = eligible.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of eligible) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  // Floating point edge case: fall back to the last eligible entry.
  return eligible[eligible.length - 1]!;
}

export function pickUniformCard(candidates: string[], rng: RandomFn): string {
  if (candidates.length === 0) {
    throw new Error("No candidate cards to pick from");
  }
  const index = Math.floor(rng() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)]!;
}

export function drawBoosterCards(
  cardCount: number,
  pool: BoosterPoolResolved,
  rng: RandomFn = defaultSecureRandom,
): DrawnCard[] {
  const draws: DrawnCard[] = [];
  for (let i = 0; i < cardCount; i++) {
    const rarity = pickWeightedRarity(pool, rng);
    const candidates = pool.cardsByRarityId[rarity.rarityId] ?? [];
    const cardDefinitionId = pickUniformCard(candidates, rng);
    draws.push({
      rarityId: rarity.rarityId,
      rarityCode: rarity.rarityCode,
      cardDefinitionId,
    });
  }
  return draws;
}

/** Deterministic seeded RNG (mulberry32) — for tests only, never production draws. */
export function seededRandom(seed: number): RandomFn {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
