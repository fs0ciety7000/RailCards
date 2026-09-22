import { grantXp, MissionsService } from "./missions.service";

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

/**
 * Fake of the slice of Prisma.TransactionClient that claimMission/
 * claimAchievement touch, wired to a mutable in-memory user profile so
 * grantXp's real level-crossing logic runs unmodified.
 */
function fakeClaimTx(initialXp: number, userMission?: Record<string, unknown>, userAchievement?: Record<string, unknown>) {
  let xp = initialXp;
  let level = 1;
  return {
    userProfile: {
      findUniqueOrThrow: async () => ({ xp, level }),
      update: async ({ data }: { data: { xp?: { increment: number }; level?: number } }) => {
        if (data.xp) xp += data.xp.increment;
        if (data.level !== undefined) level = data.level;
        return { xp, level };
      },
    },
    userMission: {
      findUnique: async () => userMission,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...userMission, ...data }),
    },
    userAchievement: {
      findUnique: async () => userAchievement,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...userAchievement, ...data }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeMissionsService(tx: unknown) {
  const wallet = { credit: jest.fn().mockResolvedValue({}) };
  const grades = { gradeForLevel: (level: number) => `Grade ${level}` };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as any;
  const service = new MissionsService(prisma, wallet as never, grades as never, notifications as never);
  return { service, notifications, wallet };
}

describe("MissionsService notifications", () => {
  it("claimMission notifies MISSION_COMPLETED, and LEVEL_UP only when xp crosses a threshold", async () => {
    const userMission = {
      id: "um-1",
      userId: "user-1",
      completedAt: new Date(),
      claimedAt: null,
      mission: { id: "m-1", title: "Ouvrir un booster", rewardCr: 20, rewardXp: 10 },
    };
    const tx = fakeClaimTx(95, userMission); // 95 + 10 = 105, crosses the level-2 threshold at 100
    const { service, notifications } = makeMissionsService(tx);

    const result = await service.claimMission("user-1", "um-1");

    expect(result.leveledUp).toBe(true);
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "MISSION_COMPLETED",
      expect.objectContaining({ missionId: "m-1", title: "Ouvrir un booster" }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "LEVEL_UP",
      expect.objectContaining({ newLevel: 2 }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it("claimMission does not notify LEVEL_UP when xp stays within the same level", async () => {
    const userMission = {
      id: "um-1",
      userId: "user-1",
      completedAt: new Date(),
      claimedAt: null,
      mission: { id: "m-1", title: "Pointer présent", rewardCr: 10, rewardXp: 5 },
    };
    const tx = fakeClaimTx(0, userMission);
    const { service, notifications } = makeMissionsService(tx);

    await service.claimMission("user-1", "um-1");

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(tx, "user-1", "MISSION_COMPLETED", expect.anything());
  });

  it("claimAchievement notifies ACHIEVEMENT_UNLOCKED and LEVEL_UP when xp crosses a threshold", async () => {
    const userAchievement = {
      id: "ua-1",
      userId: "user-1",
      achievementId: "a-1",
      completedAt: new Date(),
      claimedAt: null,
      achievement: { id: "a-1", title: "Habitué des boosters", rewardCr: 100, rewardXp: 50 },
    };
    const tx = fakeClaimTx(60, undefined, userAchievement); // 60 + 50 = 110, crosses the level-2 threshold at 100
    const { service, notifications } = makeMissionsService(tx);

    const result = await service.claimAchievement("user-1", "a-1");

    expect(result.leveledUp).toBe(true);
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "ACHIEVEMENT_UNLOCKED",
      expect.objectContaining({ achievementId: "a-1", title: "Habitué des boosters" }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "LEVEL_UP",
      expect.objectContaining({ newLevel: 2 }),
    );
  });
});
