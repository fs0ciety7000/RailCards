import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MAX_FAVORITES = 5;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favorites = await this.prisma.favoriteCard.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { cardDefinition: { include: { series: true, rarity: true } } },
    });
    return favorites.map((f) => f.cardDefinition);
  }

  /** Only cards the player actually owns at least one instance of can be favorited. */
  async add(userId: string, cardDefinitionId: string) {
    const owned = await this.prisma.cardInstance.findFirst({ where: { ownerId: userId, cardDefinitionId } });
    if (!owned) throw new BadRequestException("Vous ne possédez pas cette carte");

    const [count, existing] = await Promise.all([
      this.prisma.favoriteCard.count({ where: { userId } }),
      this.prisma.favoriteCard.findUnique({ where: { userId_cardDefinitionId: { userId, cardDefinitionId } } }),
    ]);
    if (existing) throw new ConflictException("Cette carte est déjà dans vos favoris");
    if (count >= MAX_FAVORITES) throw new ConflictException(`Vous ne pouvez avoir que ${MAX_FAVORITES} cartes favorites`);

    await this.prisma.favoriteCard.create({ data: { userId, cardDefinitionId, position: count } });
    return this.list(userId);
  }

  async remove(userId: string, cardDefinitionId: string) {
    const favorite = await this.prisma.favoriteCard.findUnique({
      where: { userId_cardDefinitionId: { userId, cardDefinitionId } },
    });
    if (!favorite) throw new NotFoundException("Cette carte n'est pas dans vos favoris");

    await this.prisma.$transaction(async (tx) => {
      await tx.favoriteCard.delete({ where: { id: favorite.id } });
      // Close the gap so positions stay a dense 0..n-1 sequence.
      const rest = await tx.favoriteCard.findMany({
        where: { userId, position: { gt: favorite.position } },
        orderBy: { position: "asc" },
      });
      for (const f of rest) {
        await tx.favoriteCard.update({ where: { id: f.id }, data: { position: f.position - 1 } });
      }
    });
    return this.list(userId);
  }
}
