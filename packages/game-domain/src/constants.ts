/** Central, documented game-balance constants (docs/product/economy.md explains the reasoning). */
export const GAME_CONSTANTS = {
  WELCOME_BONUS_CR: 500,
  DAILY_REWARD_BASE_CR: 20,
  DAILY_REWARD_STREAK_BONUS_CR: 5, // added per consecutive day, capped
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
  // Duels: how long a challenge stays open before it lapses unanswered.
  DUEL_EXPIRY_HOURS: 24,
  DUEL_MIN_WAGER_CR: 1,
  DUEL_MAX_WAGER_CR: 100_000,
} as const;
