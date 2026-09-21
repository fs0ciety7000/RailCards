import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { drawBoosterCards } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { MissionsService } from "../missions/missions.service";
import { resolveBoosterPool } from "./booster-pool-resolver";

@Injectable()
export class BoostersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly missions: MissionsService,
  ) {}

  async listDefinitions() {
    return this.prisma.boosterDefinition.findMany({ where: { isActive: true }, orderBy: { priceCr: "asc" } });
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllDefinitionsForAdmin() {
    return this.prisma.boosterDefinition.findMany({
      orderBy: { priceCr: "asc" },
      include: { pools: { where: { isActive: true }, include: { entries: { include: { rarity: true } } } } },
    });
  }

  async createDefinition(data: Parameters<PrismaService["boosterDefinition"]["create"]>[0]["data"]) {
    return this.prisma.boosterDefinition.create({ data });
  }

  async updateDefinition(id: string, data: Parameters<PrismaService["boosterDefinition"]["update"]>[0]["data"]) {
    return this.prisma.boosterDefinition.update({ where: { id }, data });
  }

  /**
   * Publishes a brand new versioned pool for a booster (deactivating the
   * previous one) so odds changes are auditable and every past opening
   * still points at the exact rules version that produced it.
   */
  async publishNewPoolVersion(
    boosterDefinitionId: string,
    entries: { rarityId: string; weight: number; seriesId?: string; cardDefinitionId?: string }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.boosterPool.findFirst({
        where: { boosterDefinitionId, isActive: true },
        orderBy: { rulesVersion: "desc" },
      });
      const nextVersion = (previous?.rulesVersion ?? 0) + 1;
      if (previous) {
        await tx.boosterPool.update({ where: { id: previous.id }, data: { isActive: false } });
      }
      const pool = await tx.boosterPool.create({
        data: { boosterDefinitionId, rulesVersion: nextVersion, isActive: true },
      });
      await tx.boosterPoolEntry.createMany({
        data: entries.map((e) => ({
          boosterPoolId: pool.id,
          rarityId: e.rarityId,
          weight: e.weight,
          seriesId: e.seriesId,
          cardDefinitionId: e.cardDefinitionId,
        })),
      });
      return tx.boosterPool.findUniqueOrThrow({ where: { id: pool.id }, include: { entries: true } });
    });
  }

  async getHistory(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.boosterOpening.findMany({
        where,
        include: {
          boosterDefinition: true,
          pulls: { include: { cardDefinition: { include: { rarity: true } } } },
        },
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.boosterOpening.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Opens a booster for `userId`. `clientIdempotencyKey` must be a unique
   * value the client generates once per "open" click (e.g. a UUID) and
   * resends unchanged on retry — repeating the same key returns the
   * original result instead of drawing new cards or double-charging.
   */
  async open(userId: string, boosterSlug: string, clientIdempotencyKey: string) {
    if (!clientIdempotencyKey || clientIdempotencyKey.length < 8) {
      throw new BadRequestException("A valid Idempotency-Key header is required to open a booster");
    }
    const idempotencyKey = `${userId}:${boosterSlug}:${clientIdempotencyKey}`;

    const existingOpening = await this.prisma.boosterOpening.findUnique({
      where: { idempotencyKey },
      include: { pulls: { include: { cardDefinition: { include: { rarity: true } } }, orderBy: { position: "asc" } } },
    });
    if (existingOpening) return existingOpening;

    const boosterDef = await this.prisma.boosterDefinition.findUnique({ where: { slug: boosterSlug } });
    if (!boosterDef || !boosterDef.isActive) throw new NotFoundException("Booster not found");

    const pool = await this.prisma.boosterPool.findFirst({
      where: { boosterDefinitionId: boosterDef.id, isActive: true },
      orderBy: { rulesVersion: "desc" },
    });
    if (!pool) throw new NotFoundException("No active pool configured for this booster");

    const resolvedPool = await resolveBoosterPool(this.prisma, pool.id);
    const draws = drawBoosterCards(boosterDef.cardCount, resolvedPool);

    return this.prisma.$transaction(async (tx) => {
      const walletTx = await this.wallet.debit(tx, {
        userId,
        amount: boosterDef.priceCr,
        type: "BOOSTER_PURCHASE",
        referenceType: "BoosterDefinition",
        referenceId: boosterDef.id,
        idempotencyKey: `booster-debit-${idempotencyKey}`,
      });

      const opening = await tx.boosterOpening.create({
        data: {
          userId,
          boosterDefinitionId: boosterDef.id,
          boosterPoolId: pool.id,
          idempotencyKey,
          pricePaidCr: boosterDef.priceCr,
          walletTransactionId: walletTx.id,
        },
      });

      const ownedDefinitionIdsBefore = new Set(
        (
          await tx.cardInstance.findMany({
            where: { ownerId: userId, cardDefinitionId: { in: draws.map((d) => d.cardDefinitionId) } },
            distinct: ["cardDefinitionId"],
            select: { cardDefinitionId: true },
          })
        ).map((c) => c.cardDefinitionId),
      );

      let newUniqueCount = 0;
      for (const [index, draw] of draws.entries()) {
        const priorCount = await tx.cardInstance.count({ where: { cardDefinitionId: draw.cardDefinitionId } });
        const cardInstance = await tx.cardInstance.create({
          data: {
            cardDefinitionId: draw.cardDefinitionId,
            ownerId: userId,
            serialNumber: priorCount + 1,
            acquiredVia: "BOOSTER",
          },
        });
        await tx.boosterPull.create({
          data: {
            boosterOpeningId: opening.id,
            cardInstanceId: cardInstance.id,
            cardDefinitionId: draw.cardDefinitionId,
            rarityId: draw.rarityId,
            position: index,
          },
        });
        if (!ownedDefinitionIdsBefore.has(draw.cardDefinitionId)) newUniqueCount += 1;
      }

      await this.missions.recordProgress(tx, userId, "OPEN_BOOSTER", 1);
      if (newUniqueCount > 0) {
        await this.missions.recordProgress(tx, userId, "COLLECT_UNIQUE_CARDS", newUniqueCount);
      }

      return tx.boosterOpening.findUniqueOrThrow({
        where: { id: opening.id },
        include: {
          pulls: { include: { cardDefinition: { include: { rarity: true } } }, orderBy: { position: "asc" } },
        },
      });
    });
  }
}
