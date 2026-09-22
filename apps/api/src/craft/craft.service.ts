import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { MissionsService } from "../missions/missions.service";

@Injectable()
export class CraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionsService,
  ) {}

  /**
   * Owned card definitions with enough AVAILABLE duplicates to fuse (>=
   * CRAFT_RECIPE_SIZE copies), one row per definition, each carrying exactly
   * CRAFT_RECIPE_SIZE of its instance ids ready to hand back to `craft()`.
   * MYTHIC is excluded since there is nothing above it to craft into.
   */
  async listCraftableGroups(userId: string) {
    const groups = await this.prisma.$queryRaw<
      { cardDefinitionId: string; count: number; instanceIds: string[] }[]
    >`
      SELECT
        ci."cardDefinitionId",
        COUNT(*)::int AS count,
        (array_agg(ci.id ORDER BY ci."acquiredAt" ASC))[1:${GAME_CONSTANTS.CRAFT_RECIPE_SIZE}] AS "instanceIds"
      FROM "CardInstance" ci
      JOIN "CardDefinition" cd ON cd.id = ci."cardDefinitionId"
      JOIN "Rarity" r ON r.id = cd."rarityId"
      WHERE ci."ownerId" = ${userId} AND ci.state = 'AVAILABLE' AND r.code != 'MYTHIC'
      GROUP BY ci."cardDefinitionId"
      HAVING COUNT(*) >= ${GAME_CONSTANTS.CRAFT_RECIPE_SIZE}
      ORDER BY MAX(ci."acquiredAt") DESC
    `;
    if (groups.length === 0) return [];

    const definitions = await this.prisma.cardDefinition.findMany({
      where: { id: { in: groups.map((g) => g.cardDefinitionId) } },
      include: { rarity: true, series: true },
    });
    const byId = new Map(definitions.map((d) => [d.id, d]));

    return groups
      .map((g) => {
        const cardDefinition = byId.get(g.cardDefinitionId);
        return cardDefinition ? { cardDefinition, count: g.count, instanceIds: g.instanceIds } : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }

  /**
   * Sacrifices CRAFT_RECIPE_SIZE same-rarity, AVAILABLE duplicates for one
   * random card at the next rarity tier up — a duplicate sink. The
   * sacrificed instances are permanently removed, along with any historical
   * rows that would otherwise block their deletion (a past booster pull, or
   * a completed trade/sale involving that exact instance); this is scoped
   * to just the sacrificed instance ids, so it never touches other items in
   * a trade or another player's own history.
   */
  async craft(userId: string, cardInstanceIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const instances = await tx.cardInstance.findMany({
        where: { id: { in: cardInstanceIds } },
        include: { cardDefinition: { include: { rarity: true } } },
      });
      if (instances.length !== cardInstanceIds.length) {
        throw new NotFoundException("One or more selected cards could not be found");
      }
      if (instances.some((i) => i.ownerId !== userId)) {
        throw new BadRequestException("You can only craft with cards you own");
      }
      if (instances.some((i) => i.state !== "AVAILABLE")) {
        throw new BadRequestException("Only available (not reserved) cards can be used for crafting");
      }
      const rarityIds = new Set(instances.map((i) => i.cardDefinition.rarityId));
      if (rarityIds.size > 1) {
        throw new BadRequestException("All sacrificed cards must be the same rarity");
      }

      const currentRarity = instances[0]!.cardDefinition.rarity;
      const nextRarity = await tx.rarity.findFirst({ where: { order: currentRarity.order + 1 } });
      if (!nextRarity) {
        throw new BadRequestException("This is already the highest rarity — nothing to craft it into");
      }

      const eligibleCards = await tx.cardDefinition.findMany({
        where: { rarityId: nextRarity.id, status: "PUBLISHED" },
        select: { id: true },
      });
      if (eligibleCards.length === 0) {
        throw new BadRequestException("No published cards exist yet at the next rarity tier");
      }

      // Consume the sacrificed instances atomically: the AVAILABLE guard in
      // the WHERE clause means a concurrent craft/trade/listing on the same
      // instance loses the race cleanly instead of double-spending it.
      const claim = await tx.cardInstance.updateMany({
        where: { id: { in: cardInstanceIds }, ownerId: userId, state: "AVAILABLE" },
        data: { state: "ARCHIVED" },
      });
      if (claim.count !== cardInstanceIds.length) {
        throw new ConflictException("One or more selected cards were no longer available");
      }

      await tx.marketTransaction.deleteMany({ where: { listing: { cardInstanceId: { in: cardInstanceIds } } } });
      await tx.marketListing.deleteMany({ where: { cardInstanceId: { in: cardInstanceIds } } });
      await tx.tradeItem.deleteMany({ where: { cardInstanceId: { in: cardInstanceIds } } });
      await tx.boosterPull.deleteMany({ where: { cardInstanceId: { in: cardInstanceIds } } });
      await tx.cardInstance.deleteMany({ where: { id: { in: cardInstanceIds } } });

      const picked = eligibleCards[Math.floor(Math.random() * eligibleCards.length)]!;
      const priorCount = await tx.cardInstance.count({ where: { cardDefinitionId: picked.id } });
      const created = await tx.cardInstance.create({
        data: { cardDefinitionId: picked.id, ownerId: userId, serialNumber: priorCount + 1, acquiredVia: "CRAFT" },
        include: { cardDefinition: { include: { series: true, rarity: true } } },
      });

      await this.missions.checkSeriesCompletion(tx, userId, [picked.id]);

      return created;
    });
  }
}
