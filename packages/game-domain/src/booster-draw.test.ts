import { describe, expect, it } from "vitest";
import { drawBoosterCards, seededRandom, type BoosterPoolResolved } from "./booster-draw";

const pool: BoosterPoolResolved = {
  rarityWeights: [
    { rarityId: "common", rarityCode: "COMMON", weight: 550 },
    { rarityId: "uncommon", rarityCode: "UNCOMMON", weight: 250 },
    { rarityId: "rare", rarityCode: "RARE", weight: 120 },
    { rarityId: "epic", rarityCode: "EPIC", weight: 50 },
    { rarityId: "legendary", rarityCode: "LEGENDARY", weight: 25 },
    { rarityId: "mythic", rarityCode: "MYTHIC", weight: 5 },
  ],
  cardsByRarityId: {
    common: ["c1", "c2", "c3"],
    uncommon: ["u1", "u2"],
    rare: ["r1"],
    epic: ["e1"],
    legendary: ["l1"],
    mythic: ["m1"],
  },
};

describe("drawBoosterCards", () => {
  it("draws the requested number of cards", () => {
    const rng = seededRandom(42);
    const draws = drawBoosterCards(5, pool, rng);
    expect(draws).toHaveLength(5);
    for (const d of draws) {
      expect(pool.cardsByRarityId[d.rarityId]).toContain(d.cardDefinitionId);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = drawBoosterCards(10, pool, seededRandom(7));
    const b = drawBoosterCards(10, pool, seededRandom(7));
    expect(a).toEqual(b);
  });

  it("respects rarity weighting over a large sample (common dominates mythic)", () => {
    const rng = seededRandom(1234);
    const draws = drawBoosterCards(5000, pool, rng);
    const counts: Record<string, number> = {};
    for (const d of draws) counts[d.rarityCode] = (counts[d.rarityCode] ?? 0) + 1;
    expect(counts.COMMON).toBeGreaterThan(counts.MYTHIC ?? 0);
    expect(counts.COMMON).toBeGreaterThan((counts.LEGENDARY ?? 0) * 5);
    // Weight ratio COMMON:MYTHIC is 110:1 — over 5000 draws expect roughly that shape.
    const commonRatio = (counts.COMMON ?? 0) / 5000;
    expect(commonRatio).toBeGreaterThan(0.45);
    expect(commonRatio).toBeLessThan(0.65);
  });

  it("never draws a rarity with zero eligible cards", () => {
    const thinPool: BoosterPoolResolved = {
      rarityWeights: pool.rarityWeights,
      cardsByRarityId: { ...pool.cardsByRarityId, mythic: [] },
    };
    const draws = drawBoosterCards(2000, thinPool, seededRandom(99));
    expect(draws.some((d) => d.rarityCode === "MYTHIC")).toBe(false);
  });

  it("throws if the pool has no eligible cards at all", () => {
    const emptyPool: BoosterPoolResolved = { rarityWeights: pool.rarityWeights, cardsByRarityId: {} };
    expect(() => drawBoosterCards(1, emptyPool, seededRandom(1))).toThrow();
  });
});
