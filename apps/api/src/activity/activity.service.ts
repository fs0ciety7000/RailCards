import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type PublicUser = { username: string; displayName: string };
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

/** Every username a participant in this event — what a friends-only filter checks membership against. */
function eventUsernames(event: ActivityEvent): string[] {
  switch (event.type) {
    case "MARKET_SALE":
      return [event.buyer.username, event.seller.username];
    case "TRADE_COMPLETED":
      return [event.initiator.username, event.recipient.username];
    case "DUEL_RESOLVED":
      return [event.winner.username, event.loser.username];
    case "SERIES_COMPLETED":
    case "RARE_PULL":
      return [event.player.username];
  }
}

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

  /**
   * `onlyUsernames`, when given, restricts the feed to events where at
   * least one participant is in that set — the "amis" tab on the activity
   * feed, backed by the caller's accepted friends rather than a separate
   * feed query.
   */
  async getFeed(limit: number, onlyUsernames?: Set<string>): Promise<ActivityEvent[]> {
    // A friends filter drops most events after the fact, so pull a deeper
    // window per source than an unfiltered feed needs, or a small friend
    // group could see an emptier feed than actually exists.
    const perSourceLimit = onlyUsernames ? Math.min(200, limit * 5) : limit;
    const [sales, trades, duels, seriesCompletions, rarePulls] = await Promise.all([
      this.prisma.marketTransaction.findMany({
        where: { buyer: PUBLIC_PROFILE_FILTER, seller: PUBLIC_PROFILE_FILTER },
        include: {
          buyer: { select: PUBLIC_USER_SELECT },
          seller: { select: PUBLIC_USER_SELECT },
          listing: { include: { cardInstance: { include: { cardDefinition: { include: { rarity: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
        take: perSourceLimit,
      }),
      this.prisma.trade.findMany({
        where: { status: "ACCEPTED", initiator: PUBLIC_PROFILE_FILTER, recipient: PUBLIC_PROFILE_FILTER },
        include: { initiator: { select: PUBLIC_USER_SELECT }, recipient: { select: PUBLIC_USER_SELECT } },
        orderBy: { respondedAt: "desc" },
        take: perSourceLimit,
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
        take: perSourceLimit,
      }),
      this.prisma.userSeriesCompletion.findMany({
        where: { user: PUBLIC_PROFILE_FILTER },
        include: { user: { select: PUBLIC_USER_SELECT }, series: { select: { name: true } } },
        orderBy: { completedAt: "desc" },
        take: perSourceLimit,
      }),
      this.prisma.boosterPull.findMany({
        where: { rarity: { order: { gte: RARE_PULL_MIN_ORDER } }, cardInstance: { owner: PUBLIC_PROFILE_FILTER } },
        include: {
          cardDefinition: true,
          rarity: true,
          cardInstance: { include: { owner: { select: PUBLIC_USER_SELECT } } },
        },
        orderBy: { cardInstance: { acquiredAt: "desc" } },
        take: perSourceLimit,
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

    const filtered = onlyUsernames ? events.filter((e) => eventUsernames(e).some((u) => onlyUsernames.has(u))) : events;
    filtered.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return filtered.slice(0, limit);
  }
}
