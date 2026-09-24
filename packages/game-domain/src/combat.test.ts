import { describe, expect, it } from "vitest";
import { combatGradeForStats, combatPowerScore } from "./combat";

describe("combatPowerScore", () => {
  it("sums the three stats", () => {
    expect(combatPowerScore({ power: 10, reliability: 20, charm: 30 })).toBe(60);
    expect(combatPowerScore({ power: 0, reliability: 0, charm: 0 })).toBe(0);
    expect(combatPowerScore({ power: 100, reliability: 100, charm: 100 })).toBe(300);
  });
});

describe("combatGradeForStats", () => {
  it("grades the lowest possible score D and the maximum score S", () => {
    expect(combatGradeForStats({ power: 0, reliability: 0, charm: 0 }).grade).toBe("D");
    expect(combatGradeForStats({ power: 100, reliability: 100, charm: 100 }).grade).toBe("S");
  });

  it("assigns exactly the tier a score falls into, at each threshold boundary", () => {
    // Boundaries: D < 60, C [60,120), B [120,180), A [180,240), S >= 240.
    expect(combatGradeForStats({ power: 20, reliability: 20, charm: 19 }).grade).toBe("D"); // 59
    expect(combatGradeForStats({ power: 20, reliability: 20, charm: 20 }).grade).toBe("C"); // 60
    expect(combatGradeForStats({ power: 40, reliability: 40, charm: 39 }).grade).toBe("C"); // 119
    expect(combatGradeForStats({ power: 40, reliability: 40, charm: 40 }).grade).toBe("B"); // 120
    expect(combatGradeForStats({ power: 60, reliability: 60, charm: 59 }).grade).toBe("B"); // 179
    expect(combatGradeForStats({ power: 60, reliability: 60, charm: 60 }).grade).toBe("A"); // 180
    expect(combatGradeForStats({ power: 80, reliability: 80, charm: 79 }).grade).toBe("A"); // 239
    expect(combatGradeForStats({ power: 80, reliability: 80, charm: 80 }).grade).toBe("S"); // 240
  });

  it("gives every grade a distinct label and color", () => {
    const grades = [0, 65, 125, 185, 245].map((score) => combatGradeForStats({ power: score, reliability: 0, charm: 0 }));
    const labels = new Set(grades.map((g) => g.label));
    const colors = new Set(grades.map((g) => g.colorHex));
    expect(labels.size).toBe(5);
    expect(colors.size).toBe(5);
  });
});
