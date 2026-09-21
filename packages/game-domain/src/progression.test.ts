import { describe, expect, it } from "vitest";
import { levelForXp, xpThresholdForLevel } from "./progression";

describe("progression", () => {
  it("level 1 starts at 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpThresholdForLevel(1)).toBe(0);
  });

  it("is monotonic and matches its own thresholds", () => {
    for (let level = 1; level <= 20; level++) {
      const threshold = xpThresholdForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      expect(levelForXp(threshold - 1 < 0 ? 0 : threshold - 1)).toBeLessThanOrEqual(level);
    }
  });
});
