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
} as const;
