import { grantXp } from "./missions.service";

/** Minimal fake of the slice of Prisma.TransactionClient that grantXp touches. */
function fakeTx(initialXp: number) {
  let xp = initialXp;
  let level = 1;
  const updateCalls: Array<Record<string, unknown>> = [];
  return {
    tx: {
      userProfile: {
        findUniqueOrThrow: async () => ({ xp, level }),
        update: async ({ data }: { data: { xp?: { increment: number }; level?: number } }) => {
          updateCalls.push(data);
          if (data.xp) xp += data.xp.increment;
          if (data.level !== undefined) level = data.level;
          return { xp, level };
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    updateCalls,
  };
}

describe("grantXp", () => {
  it("does not report a level-up when xp stays within the same level", async () => {
    const { tx, updateCalls } = fakeTx(0);
    const result = await grantXp(tx, "user-1", 10);
    expect(result).toEqual({ leveledUp: false, newLevel: 1, newGrade: "Apprenti aiguilleur" });
    // Only the xp increment was written, no redundant level write.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual({ xp: { increment: 10 } });
  });

  it("reports a level-up and writes the new level when xp crosses a threshold", async () => {
    const { tx, updateCalls } = fakeTx(95); // level 2 starts at 100 xp
    const result = await grantXp(tx, "user-1", 10);
    expect(result).toEqual({ leveledUp: true, newLevel: 2, newGrade: "Apprenti aiguilleur" });
    expect(updateCalls).toEqual([{ xp: { increment: 10 } }, { level: 2 }]);
  });

  it("can cross several levels in a single grant and reports the final level", async () => {
    const { tx } = fakeTx(0);
    // level 4 starts at xpThresholdForLevel(4) = 100 * (3*4/2) = 600
    const result = await grantXp(tx, "user-1", 650);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(4);
  });
});
