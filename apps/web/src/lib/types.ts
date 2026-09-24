// Mirrors the API's Prisma-backed response shapes. Kept intentionally loose
// (many optional/`unknown` fields) since these are hand-written against the
// live Swagger/service code, not generated.

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface Me {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  xp: number;
  level: number;
  grade: string;
  xpProgress: { xpIntoLevel: number; xpForNextLevel: number };
  dailyRewardStreak: number;
  walletBalance: number;
  favoriteCards: CardDefinition[];
  activeBanner: ProfileBanner | null;
  unlockedBanners: ProfileBanner[];
  activeTitle: ProfileTitle | null;
  unlockedTitles: ProfileTitle[];
}

export interface PublicProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  bio: string | null;
  isPublic: boolean;
  level: number;
  grade: string;
  memberSince: string;
  uniqueCardCount: number;
  totalSeriesCount: number;
  favoriteCards: CardDefinition[];
  activeBanner: ProfileBanner | null;
  activeTitle: ProfileTitle | null;
  achievements: ProfileAchievementBadge[];
}

export interface ProfileAchievementBadge {
  id: string;
  code: string;
  title: string;
  description: string;
  claimedAt: string;
}

export interface PersonalStats {
  creditsEarned: number;
  creditsSpent: number;
  activeDays: number;
  totalCardsPulled: number;
  totalBoostersOpened: number;
  topPulledCards: {
    cardDefinitionId: string;
    name: string;
    imageUrl: string;
    rarity: { code: string; label: string; colorHex: string };
    pullCount: number;
  }[];
}

export interface ProfileBanner {
  id: string;
  slug: string;
  name: string;
  colorFrom: string;
  colorTo: string;
  icon: string;
}

export interface ProfileTitle {
  id: string;
  slug: string;
  label: string;
}

export type LeaderboardSort = "xp" | "cards" | "albums";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  xp: number;
  level: number;
  grade: string;
  uniqueCardCount: number;
  completeSeriesCount: number;
}

export interface LevelUpInfo {
  leveledUp: boolean;
  newLevel: number;
  newGrade: string;
}

export interface Rarity {
  id: string;
  code: string;
  label: string;
  order: number;
  colorHex: string;
}

export type CardCategory = "ROLLING_STOCK" | "STATION_PLACE" | "PROFESSION" | "DAILY_LIFE_HUMOR" | "SPECIAL_EDITION";
export type CardStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface CardSeries {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CardCategory;
  isActive: boolean;
  releaseAt: string | null;
  coverImageUrl: string | null;
  _count?: { cards: number };
}

export interface CardDefinition {
  id: string;
  slug: string;
  seriesId: string;
  series: CardSeries;
  name: string;
  description: string;
  flavorText: string | null;
  category: CardCategory;
  rarityId: string;
  rarity: Rarity;
  imageUrl: string;
  status: CardStatus;
  combatStatsEnabled: boolean;
  combatStats: unknown;
}

export type CardInstanceState = "AVAILABLE" | "RESERVED_TRADE" | "RESERVED_MARKET" | "ARCHIVED";
export type AcquisitionSource =
  | "BOOSTER"
  | "TRADE"
  | "MARKET"
  | "ADMIN_GRANT"
  | "MISSION_REWARD"
  | "ACHIEVEMENT_REWARD"
  | "FOUNDER_GRANT";

export interface CardInstance {
  id: string;
  cardDefinitionId: string;
  cardDefinition: CardDefinition;
  ownerId: string;
  serialNumber: number;
  state: CardInstanceState;
  acquiredVia: AcquisitionSource;
  acquiredAt: string;
  /** Cosmetic-only holo/foil variant — no stat or rarity effect. */
  isFoil: boolean;
  /** Present on grouped listings (e.g. the collection grid): how many owned copies this entry stacks for. */
  count?: number;
}

export interface CardInstanceDetail extends CardInstance {
  owner: { username: string };
  isOwnedByRequester: boolean;
}

export interface AlbumSeriesEntry {
  seriesId: string;
  slug: string;
  name: string;
  category: CardCategory;
  coverImageUrl: string | null;
  totalCards: number;
  ownedUniqueCards: number;
  completionPct: number;
}

export interface AlbumSeriesCard {
  id: string;
  slug: string;
  name: string | null;
  rarity: Rarity;
  imageUrl: string | null;
  owned: boolean;
}

export interface AlbumSeriesDetail {
  seriesId: string;
  name: string;
  category: CardCategory;
  cards: AlbumSeriesCard[];
}

export type BoosterCategory = "DISCOVERY" | "CLASSIC" | "THEMED";

export interface BoosterDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: BoosterCategory;
  priceCr: number;
  cardCount: number;
  imageUrl: string;
  isActive: boolean;
}

export interface BoosterPull {
  id: string;
  cardDefinitionId: string;
  // The API includes the rarity only nested under cardDefinition.rarity,
  // not as a sibling `rarity`/`rarityId` on the pull itself — use
  // `cardDefinition.rarity` for display.
  cardDefinition: CardDefinition;
  position: number;
}

export interface BoosterOpening {
  id: string;
  userId: string;
  boosterDefinitionId: string;
  /** Present on /boosters/history entries; the /boosters/open response omits it. */
  boosterDefinition?: BoosterDefinition;
  idempotencyKey: string;
  pricePaidCr: number;
  openedAt: string;
  pulls: BoosterPull[];
}

export interface FreeBoosterStatus {
  claimable: boolean;
  nextAvailableAt: string | null;
}

export type MarketListingStatus = "ACTIVE" | "SOLD" | "CANCELLED";

export type MarketListingType = "FIXED" | "AUCTION";

export interface MarketListing {
  id: string;
  sellerId: string;
  seller: { username: string; displayName: string };
  cardInstanceId: string;
  cardInstance: CardInstance;
  priceCr: number;
  feeBps: number;
  status: MarketListingStatus;
  listingType: MarketListingType;
  auctionEndsAt: string | null;
  currentBidCr: number | null;
  currentBidderId: string | null;
  currentBidder: { username: string; displayName: string } | null;
  createdAt: string;
  soldAt: string | null;
  cancelledAt: string | null;
}

export type TradeStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "COUNTERED";
export type TradeSide = "INITIATOR" | "RECIPIENT";

export interface TradeItem {
  id: string;
  cardInstanceId: string;
  cardInstance: CardInstance;
  side: TradeSide;
}

export interface Trade {
  id: string;
  initiatorId: string;
  initiator: { username: string; displayName: string };
  recipientId: string;
  recipient: { username: string; displayName: string };
  status: TradeStatus;
  initiatorCr: number;
  recipientCr: number;
  message: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  items: TradeItem[];
}

export type DuelStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type DuelStat = "POWER" | "RELIABILITY" | "CHARM";

export interface Duel {
  id: string;
  challengerId: string;
  challenger: { username: string; displayName: string };
  opponentId: string;
  opponent: { username: string; displayName: string };
  challengerCardInstanceId: string;
  challengerCardInstance: CardInstance;
  opponentCardInstanceId: string | null;
  opponentCardInstance: CardInstance | null;
  wagerCr: number;
  status: DuelStatus;
  stat: DuelStat | null;
  challengerValue: number | null;
  opponentValue: number | null;
  winnerId: string | null;
  winner: { username: string; displayName: string } | null;
  message: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
}

export type QuestStatus = "ACTIVE" | "ARCHIVED";

export interface QuestStepEntry {
  id: string;
  order: number;
  title: string;
  narrative: string;
  goalType: MissionGoalType;
  goalCount: number;
  rewardCr: number;
  rewardXp: number;
  progress: number;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface ActiveQuest {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  steps: QuestStepEntry[];
}

export interface AdminQuestStep {
  id: string;
  order: number;
  title: string;
  narrative: string;
  goalType: MissionGoalType;
  goalCount: number;
  rewardCr: number;
  rewardXp: number;
}

export interface AdminQuest {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: QuestStatus;
  createdAt: string;
  steps: AdminQuestStep[];
}

export type WantedListingStatus = "OPEN" | "FULFILLED" | "CANCELLED";

export interface WantedListing {
  id: string;
  posterId: string;
  poster: { username: string; displayName: string };
  cardDefinitionId: string;
  cardDefinition: CardDefinition;
  note: string | null;
  status: WantedListingStatus;
  createdAt: string;
  updatedAt: string;
}

export type GuildRole = "LEADER" | "OFFICER" | "MEMBER";

export interface GuildMemberEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: GuildRole;
  joinedAt: string;
  xp: number;
  level: number;
  grade: string;
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  leaderId: string;
  leader: { username: string; displayName: string };
  createdAt: string;
  xp: number;
  level: number;
  xpProgress: { xpIntoLevel: number; xpForNextLevel: number };
  maxMembers: number;
  memberCount: number;
  members: GuildMemberEntry[];
}

export interface GuildLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  totalXp: number;
  totalUniqueCards: number;
}

export interface GuildMessage {
  id: string;
  guildId: string;
  authorId: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  body: string;
  createdAt: string;
}

type PublicUserRef = { username: string; displayName: string };
type ActivityRarity = { code: string; label: string; colorHex: string };

export type ActivityEvent =
  | { type: "MARKET_SALE"; occurredAt: string; buyer: PublicUserRef; seller: PublicUserRef; cardName: string; rarity: ActivityRarity; priceCr: number }
  | { type: "TRADE_COMPLETED"; occurredAt: string; initiator: PublicUserRef; recipient: PublicUserRef }
  | { type: "DUEL_RESOLVED"; occurredAt: string; winner: PublicUserRef; loser: PublicUserRef; wagerCr: number }
  | { type: "SERIES_COMPLETED"; occurredAt: string; player: PublicUserRef; seriesName: string }
  | { type: "RARE_PULL"; occurredAt: string; player: PublicUserRef; cardName: string; rarity: ActivityRarity };

export type GuildActivityEvent =
  | ActivityEvent
  | { type: "GUILD_MEMBER_JOINED"; occurredAt: string; member: PublicUserRef }
  | { type: "QUEST_STEP_COMPLETED"; occurredAt: string; member: PublicUserRef; questTitle: string; stepTitle: string };

export interface Friend {
  friendshipId: string;
  friendSince: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface FriendRequest {
  id: string;
  createdAt: string;
  user: { username: string; displayName: string; avatarUrl: string | null; role: UserRole };
}

export interface SeasonPassTier {
  id: string;
  tier: number;
  pointsRequired: number;
  rewardCr: number;
  rewardXp: number;
  rewardLabel: string | null;
  unlocked: boolean;
  claimed: boolean;
}

export interface SeasonPassBoard {
  season: { id: string; name: string; startedAt: string } | null;
  points: number;
  tiers: SeasonPassTier[];
}

export interface AdminSeasonPassTier {
  id: string;
  seasonId: string;
  tier: number;
  pointsRequired: number;
  rewardCr: number;
  rewardXp: number;
  rewardLabel: string | null;
  createdAt: string;
}

export interface AdminSeasonPassBoard {
  season: { id: string; name: string; status: SeasonStatus } | null;
  tiers: AdminSeasonPassTier[];
}

export type MissionGoalType =
  | "OPEN_BOOSTER"
  | "COLLECT_UNIQUE_CARDS"
  | "COMPLETE_TRADE"
  | "SELL_ON_MARKET"
  | "BUY_ON_MARKET"
  | "LOGIN"
  | "COMPLETE_SERIES";

export interface Mission {
  id: string;
  code: string;
  title: string;
  description: string;
  goalType: MissionGoalType;
  goalCount: number;
  rewardCr: number;
  rewardXp: number;
  resetPeriod: "NONE" | "DAILY";
  isActive: boolean;
}

export interface MissionProgress {
  mission: Mission;
  userMissionId: string | null;
  progress: number;
  completedAt: string | null;
  claimedAt: string | null;
  periodKey: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  goalType: MissionGoalType;
  goalCount: number;
  rewardCr: number;
  rewardXp: number;
  rewardBannerId: string | null;
  rewardTitleId: string | null;
  isActive: boolean;
}

export interface Grade {
  id: string;
  minLevel: number;
  title: string;
}

export interface AchievementProgress {
  achievement: Achievement;
  progress: number;
  completedAt: string | null;
  claimedAt: string | null;
}

export type NotificationType =
  | "TRADE_RECEIVED"
  | "TRADE_ACCEPTED"
  | "TRADE_REJECTED"
  | "TRADE_CANCELLED"
  | "TRADE_COUNTERED"
  | "TRADE_EXPIRED"
  | "MARKET_SOLD"
  | "AUCTION_OUTBID"
  | "AUCTION_NEW_BID"
  | "AUCTION_WON"
  | "AUCTION_ENDED_NO_BIDS"
  | "GUILD_KICKED"
  | "GUILD_PROMOTED"
  | "GUILD_DEMOTED"
  | "GUILD_LEADERSHIP_TRANSFERRED"
  | "GUILD_DISBANDED"
  | "GUILD_LEVELED_UP"
  | "QUEST_STEP_COMPLETED"
  | "QUEST_COMPLETED"
  | "WANTED_CARD_LISTED"
  | "GUILD_WAR_REWARD"
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "FRIEND_REQUEST_DECLINED"
  | "SEASON_PASS_REWARD"
  | "MISSION_COMPLETED"
  | "ACHIEVEMENT_UNLOCKED"
  | "LEVEL_UP"
  | "CREDITS_EARNED"
  | "SERIES_COMPLETED"
  | "DUEL_RECEIVED"
  | "DUEL_RESOLVED"
  | "DUEL_DECLINED"
  | "DUEL_CANCELLED"
  | "DUEL_EXPIRED"
  | "SYSTEM";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  code: string;
  email: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  usedByUserId: string | null;
  usedAt: string | null;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  balance: number;
}

export type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";

export interface Report {
  id: string;
  reporterId: string;
  targetUserId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actor: { username: string } | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
}

export interface SiteAnnouncement {
  message: string;
  updatedAt: string;
}

export interface AdminSiteAnnouncement {
  id: string;
  message: string;
  isActive: boolean;
  updatedAt: string;
}

export interface LiveEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  bannerImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  xpMultiplierBps: number;
  createdAt: string;
  updatedAt: string;
}

export type SeasonStatus = "ACTIVE" | "ENDED";

export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface SeasonLeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  points: number;
}

export interface SeasonLeaderboard {
  season: { id: string; name: string; startedAt: string } | null;
  entries: SeasonLeaderboardEntry[];
}

export type GuildWarStatus = "ACTIVE" | "ENDED";

export interface GuildWarPeriod {
  id: string;
  name: string;
  status: GuildWarStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface GuildWarEntry {
  rank: number;
  guildId: string;
  name: string;
  tag: string;
  memberCount: number;
  points: number;
}

export interface GuildWarLeaderboard {
  period: { id: string; name: string; startedAt: string } | null;
  entries: GuildWarEntry[];
}

export interface PriceHistoryPoint {
  day: string;
  salesCount: number;
  avgPriceCr: number;
  minPriceCr: number;
  maxPriceCr: number;
}
