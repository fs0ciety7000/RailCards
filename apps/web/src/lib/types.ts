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
}

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
export type AcquisitionSource = "BOOSTER" | "TRADE" | "MARKET" | "ADMIN_GRANT" | "MISSION_REWARD" | "ACHIEVEMENT_REWARD";

export interface CardInstance {
  id: string;
  cardDefinitionId: string;
  cardDefinition: CardDefinition;
  ownerId: string;
  serialNumber: number;
  state: CardInstanceState;
  acquiredVia: AcquisitionSource;
  acquiredAt: string;
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

export interface MarketListing {
  id: string;
  sellerId: string;
  seller: { username: string; displayName: string };
  cardInstanceId: string;
  cardInstance: CardInstance;
  priceCr: number;
  feeBps: number;
  status: MarketListingStatus;
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
  | "MISSION_COMPLETED"
  | "ACHIEVEMENT_UNLOCKED"
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
