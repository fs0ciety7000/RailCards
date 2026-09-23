/** Central, documented game-balance constants (docs/product/economy.md explains the reasoning). */
export const GAME_CONSTANTS = {
  WELCOME_BONUS_CR: 500,
  DAILY_REWARD_BASE_CR: 20,
  DAILY_REWARD_BASE_XP: 15,
  // Streak multiplier: +20% per consecutive day beyond the first, capped —
  // e.g. a 7-day streak grants 1 + 6*0.2 = 2.2x the base CR and XP.
  DAILY_REWARD_STREAK_MULTIPLIER_STEP: 0.2,
  DAILY_REWARD_STREAK_CAP_DAYS: 7,
  DEFAULT_MARKET_FEE_BPS: 500, // 5%
  TRADE_DEFAULT_EXPIRY_HOURS: 48,
  MARKET_LISTING_MIN_PRICE_CR: 1,
  FREE_BOOSTER_SLUG: "booster-gratuit",
  FREE_BOOSTER_INTERVAL_HOURS: 4,
  // Granted automatically at registration to every account created before
  // the cutoff — a one-time thank-you for joining during the early days.
  FOUNDERS_CARD_SLUG: "carte-fondateurs-railcards",
  FOUNDERS_CARD_CUTOFF_ISO: "2028-01-01T00:00:00.000Z",
  // Fusion/craft: sacrifice this many same-rarity duplicates for one random
  // card at the next rarity tier up. A duplicate sink, and MYTHIC has no
  // tier above it so it can never be a craft input.
  CRAFT_RECIPE_SIZE: 3,
  // Card variants: sacrifice this many same-card, non-foil duplicates to
  // turn one of them into a holo/foil version of the exact same card —
  // cosmetic only, no rarity or stat change.
  CARD_FOIL_RECIPE_SIZE: 3,
  // Duels: how long a challenge stays open before it lapses unanswered.
  DUEL_EXPIRY_HOURS: 24,
  DUEL_MIN_WAGER_CR: 1,
  DUEL_MAX_WAGER_CR: 100_000,
  // Market auctions: how long a seller can run one for.
  AUCTION_MIN_DURATION_HOURS: 1,
  AUCTION_MAX_DURATION_HOURS: 168, // 7 days
  AUCTION_DEFAULT_DURATION_HOURS: 24,
  // Guilds: small player-run groups.
  GUILD_NAME_MIN_LENGTH: 3,
  GUILD_NAME_MAX_LENGTH: 30,
  GUILD_TAG_MIN_LENGTH: 2,
  GUILD_TAG_MAX_LENGTH: 5,
  GUILD_MAX_MEMBERS: 30,
  // Guild wars: CR paid to every member of the top-3 guild when a war
  // period ends, scaled down by rank.
  GUILD_WAR_REWARD_CR_RANK_1: 500,
  GUILD_WAR_REWARD_CR_RANK_2: 250,
  GUILD_WAR_REWARD_CR_RANK_3: 100,
} as const;
