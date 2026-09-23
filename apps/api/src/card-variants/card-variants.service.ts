import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CardVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Owned card definitions with enough AVAILABLE, non-foil duplicates to
   * foil-ify (>= CARD_FOIL_RECIPE_SIZE copies), one row per definition,
   * each carrying exactly CARD_FOIL_RECIPE_SIZE of its instance ids ready
   * to hand back to `foilify()`. Same shape as CraftService.listCraftableGroups.
   */
  async listFoilableGroups(userId: string) {
    const groups = await this.prisma.$queryRaw<
      { cardDefinitionId: string; count: number; instanceIds: string[] }[]
    >`
      SELECT
        ci."cardDefinitionId",
        COUNT(*)::int AS count,
        (array_agg(ci.id ORDER BY ci."acquiredAt" ASC))[1:${GAME_CONSTANTS.CARD_FOIL_RECIPE_SIZE}] AS "instanceIds"
      FROM "CardInstance" ci
      WHERE ci."ownerId" = ${userId} AND ci.state = 'AVAILABLE' AND ci."isFoil" = false
      GROUP BY ci."cardDefinitionId"
      HAVING COUNT(*) >= ${GAME_CONSTANTS.CARD_FOIL_RECIPE_SIZE}
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
   * Sacrifices CARD_FOIL_RECIPE_SIZE AVAILABLE, non-foil duplicates of the
   * exact same card: one of them (the first, by acquisition order) becomes
   * holo/foil in place — same instance, same serial number, just the flag
   * flipped — and the rest are permanently removed as fuel, exactly like
   * CraftService.craft's sacrifice. No rarity or stat change; this is a
   * cosmetic-only duplicate sink, separate from the rarity-upgrade fusion.
   */
  async foilify(userId: string, cardInstanceIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const instances = await tx.cardInstance.findMany({
        where: { id: { in: cardInstanceIds } },
        include: { cardDefinition: { include: { rarity: true, series: true } } },
      });
      if (instances.length !== cardInstanceIds.length) {
        throw new NotFoundException("One or more selected cards could not be found");
      }
      if (instances.some((i) => i.ownerId !== userId)) {
        throw new BadRequestException("You can only foil cards you own");
      }
      if (instances.some((i) => i.state !== "AVAILABLE")) {
        throw new BadRequestException("Only available (not reserved) cards can be used to foil");
      }
      if (instances.some((i) => i.isFoil)) {
        throw new BadRequestException("A card that is already foil cannot be used as fuel");
      }
      const definitionIds = new Set(instances.map((i) => i.cardDefinitionId));
      if (definitionIds.size > 1) {
        throw new BadRequestException("All sacrificed cards must be the exact same card");
      }

      const [kept, ...fuel] = instances.sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime());
      const fuelIds = fuel.map((i) => i.id);

      // Consume the fuel instances atomically: the AVAILABLE guard means a
      // concurrent craft/trade/listing on one of them loses the race
      // cleanly instead of double-spending it.
      const claim = await tx.cardInstance.updateMany({
        where: { id: { in: fuelIds }, ownerId: userId, state: "AVAILABLE" },
        data: { state: "ARCHIVED" },
      });
      if (claim.count !== fuelIds.length) {
        throw new ConflictException("One or more selected cards were no longer available");
      }

      if (fuelIds.length > 0) {
        await tx.marketTransaction.deleteMany({ where: { listing: { cardInstanceId: { in: fuelIds } } } });
        await tx.marketListing.deleteMany({ where: { cardInstanceId: { in: fuelIds } } });
        await tx.tradeItem.deleteMany({ where: { cardInstanceId: { in: fuelIds } } });
        await tx.boosterPull.deleteMany({ where: { cardInstanceId: { in: fuelIds } } });
        await tx.cardInstance.deleteMany({ where: { id: { in: fuelIds } } });
      }

      return tx.cardInstance.update({
        where: { id: kept!.id },
        data: { isFoil: true },
        include: { cardDefinition: { include: { series: true, rarity: true } } },
      });
    });
  }
}
