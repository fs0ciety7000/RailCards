import { describe, expect, it } from "vitest";
import { GRADES, MAX_LEVEL, gradeForLevel, levelForXp, xpThresholdForLevel } from "./progression";

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

describe("gradeForLevel", () => {
  it("starts at the first grade for level 1", () => {
    expect(gradeForLevel(1)).toBe(GRADES[0]!.title);
  });

  it("returns exactly the tier a level falls into", () => {
    expect(gradeForLevel(4)).toBe("Apprenti aiguilleur");
    expect(gradeForLevel(5)).toBe("Voyageur régulier");
    expect(gradeForLevel(9)).toBe("Voyageur régulier");
    expect(gradeForLevel(10)).toBe("Contrôleur");
  });

  it("never returns a grade above MAX_LEVEL's tier and is monotonically non-decreasing", () => {
    let lastIndex = 0;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const title = gradeForLevel(level);
      const index = GRADES.findIndex((g) => g.title === title);
      expect(index).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = index;
    }
    expect(gradeForLevel(MAX_LEVEL)).toBe(GRADES[GRADES.length - 1]!.title);
  });
});
