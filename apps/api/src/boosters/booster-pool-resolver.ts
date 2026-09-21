import type { PrismaService } from "../prisma/prisma.service";
import type { BoosterPoolResolved } from "@railcards/game-domain";

/**
 * Resolves a BoosterPool's configured rarity weights into the eligible
 * published card ids per rarity, honoring any series/card scoping on
 * individual pool entries (used by themed boosters).
 */
export async function resolveBoosterPool(prisma: PrismaService, boosterPoolId: string): Promise<BoosterPoolResolved> {
  const entries = await prisma.boosterPoolEntry.findMany({
    where: { boosterPoolId },
    include: { rarity: true },
  });

  const weightByRarity = new Map<string, { rarityCode: string; weight: number }>();
  const cardsByRarityId: Record<string, Set<string>> = {};

  for (const entry of entries) {
    const current = weightByRarity.get(entry.rarityId);
    weightByRarity.set(entry.rarityId, {
      rarityCode: entry.rarity.code,
      weight: (current?.weight ?? 0) + entry.weight,
    });

    const candidates = await prisma.cardDefinition.findMany({
      where: {
        status: "PUBLISHED",
        rarityId: entry.rarityId,
        seriesId: entry.seriesId ?? undefined,
        id: entry.cardDefinitionId ?? undefined,
      },
      select: { id: true },
    });

    cardsByRarityId[entry.rarityId] ??= new Set();
    for (const c of candidates) cardsByRarityId[entry.rarityId]!.add(c.id);
  }

  return {
    rarityWeights: [...weightByRarity.entries()].map(([rarityId, v]) => ({
      rarityId,
      rarityCode: v.rarityCode,
      weight: v.weight,
    })),
    cardsByRarityId: Object.fromEntries(
      Object.entries(cardsByRarityId).map(([rarityId, set]) => [rarityId, [...set]]),
    ),
  };
}
