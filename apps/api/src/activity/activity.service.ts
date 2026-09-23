import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type PublicUser = { username: string; displayName: string };
type RarityInfo = { code: string; label: string; colorHex: string };

interface MarketSaleEvent {
  type: "MARKET_SALE";
  occurredAt: Date;
  buyer: PublicUser;
  seller: PublicUser;
  cardName: string;
  rarity: RarityInfo;
  priceCr: number;
}

interface TradeCompletedEvent {
  type: "TRADE_COMPLETED";
  occurredAt: Date;
  initiator: PublicUser;
  recipient: PublicUser;
}

interface DuelResolvedEvent {
  type: "DUEL_RESOLVED";
  occurredAt: Date;
  winner: PublicUser;
  loser: PublicUser;
  wagerCr: number;
}

interface SeriesCompletedEvent {
  type: "SERIES_COMPLETED";
  occurredAt: Date;
  player: PublicUser;
  seriesName: string;
}

interface RareBoosterPullEvent {
  type: "RARE_PULL";
  occurredAt: Date;
  player: PublicUser;
  cardName: string;
  rarity: RarityInfo;
}

export type ActivityEvent =
  | MarketSaleEvent
  | TradeCompletedEvent
  | DuelResolvedEvent
  | SeriesCompletedEvent
  | RareBoosterPullEvent;

const PUBLIC_USER_SELECT = { username: true, displayName: true } as const;
// Players who've hidden their profile stay out of the public feed, same as
// the leaderboard — this is a network activity board, not a private log.
const PUBLIC_PROFILE_FILTER = { profile: { isPublic: true } } as const;
// Only legendary/mythic pulls are feed-worthy; anything common would drown
// out everything else within minutes.
const RARE_PULL_MIN_ORDER = 5;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(limit: number): Promise<ActivityEvent[]> {
    const [sales, trades, duels, seriesCompletions, rarePulls] = await Promise.all([
      this.prisma.marketTransaction.findMany({
        where: { buyer: PUBLIC_PROFILE_FILTER, seller: PUBLIC_PROFILE_FILTER },
        include: {
          buyer: { select: PUBLIC_USER_SELECT },
          seller: { select: PUBLIC_USER_SELECT },
          listing: { include: { cardInstance: { include: { cardDefinition: { include: { rarity: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      this.prisma.trade.findMany({
        where: { status: "ACCEPTED", initiator: PUBLIC_PROFILE_FILTER, recipient: PUBLIC_PROFILE_FILTER },
        include: { initiator: { select: PUBLIC_USER_SELECT }, recipient: { select: PUBLIC_USER_SELECT } },
        orderBy: { respondedAt: "desc" },
        take: limit,
      }),
      this.prisma.duel.findMany({
        where: {
          status: "ACCEPTED",
          winnerId: { not: null },
          challenger: PUBLIC_PROFILE_FILTER,
          opponent: PUBLIC_PROFILE_FILTER,
        },
        include: { challenger: { select: PUBLIC_USER_SELECT }, opponent: { select: PUBLIC_USER_SELECT } },
        orderBy: { respondedAt: "desc" },
        take: limit,
      }),
      this.prisma.userSeriesCompletion.findMany({
        where: { user: PUBLIC_PROFILE_FILTER },
        include: { user: { select: PUBLIC_USER_SELECT }, series: { select: { name: true } } },
        orderBy: { completedAt: "desc" },
        take: limit,
      }),
      this.prisma.boosterPull.findMany({
        where: { rarity: { order: { gte: RARE_PULL_MIN_ORDER } }, cardInstance: { owner: PUBLIC_PROFILE_FILTER } },
        include: {
          cardDefinition: true,
          rarity: true,
          cardInstance: { include: { owner: { select: PUBLIC_USER_SELECT } } },
        },
        orderBy: { cardInstance: { acquiredAt: "desc" } },
        take: limit,
      }),
    ]);

    const events: ActivityEvent[] = [
      ...sales.map(
        (s): MarketSaleEvent => ({
          type: "MARKET_SALE",
          occurredAt: s.createdAt,
          buyer: s.buyer,
          seller: s.seller,
          cardName: s.listing.cardInstance.cardDefinition.name,
          rarity: s.listing.cardInstance.cardDefinition.rarity,
          priceCr: s.priceCr,
        }),
      ),
      ...trades
        .filter((t) => t.respondedAt)
        .map(
          (t): TradeCompletedEvent => ({
            type: "TRADE_COMPLETED",
            occurredAt: t.respondedAt!,
            initiator: t.initiator,
            recipient: t.recipient,
          }),
        ),
      ...duels
        .filter((d) => d.respondedAt)
        .map(
          (d): DuelResolvedEvent => ({
            type: "DUEL_RESOLVED",
            occurredAt: d.respondedAt!,
            winner: d.winnerId === d.challengerId ? d.challenger : d.opponent,
            loser: d.winnerId === d.challengerId ? d.opponent : d.challenger,
            wagerCr: d.wagerCr,
          }),
        ),
      ...seriesCompletions.map(
        (c): SeriesCompletedEvent => ({
          type: "SERIES_COMPLETED",
          occurredAt: c.completedAt,
          player: c.user,
          seriesName: c.series.name,
        }),
      ),
      ...rarePulls.map(
        (p): RareBoosterPullEvent => ({
          type: "RARE_PULL",
          occurredAt: p.cardInstance.acquiredAt,
          player: p.cardInstance.owner,
          cardName: p.cardDefinition.name,
          rarity: p.rarity,
        }),
      ),
    ];

    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return events.slice(0, limit);
  }
}
