import { useAuthStore } from "./auth-store";
import type * as T from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  statusCode: number;
  error?: string;
  messages: string[];

  constructor(statusCode: number, message: string, messages: string[], error?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.messages = messages;
    this.error = error;
  }
}

function extractMessage(body: unknown): { message: string; messages: string[]; error?: string } {
  if (body && typeof body === "object" && "message" in body) {
    const raw = (body as { message: unknown }).message;
    const error = "error" in body ? String((body as { error?: unknown }).error ?? "") : undefined;
    if (Array.isArray(raw)) {
      return { message: raw.join(" "), messages: raw.map(String), error };
    }
    return { message: String(raw), messages: [String(raw)], error };
  }
  return { message: "Une erreur inconnue est survenue", messages: [] };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip the automatic 401 -> refresh -> retry dance (used by refresh itself). */
  skipAuthRetry?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Tries once to restore a session from the httpOnly refresh cookie. Shared
 * (via a singleton in-flight promise) between the app-load bootstrap and
 * the 401-triggered auto-retry so two callers racing — e.g. React Strict
 * Mode's intentional double-effect in development — never fire two real
 * `/auth/refresh` calls back to back. That matters because each refresh
 * rotates the single-use refresh cookie: a second call reusing the
 * already-rotated token would look like token theft to the API and revoke
 * every session for the user.
 */
export async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; user: T.AuthUser };
        useAuthStore.getState().setSession(data.accessToken, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function withAuthRetry(doFetch: () => Promise<Response>, path: string, skipAuthRetry?: boolean): Promise<Response> {
  let res = await doFetch();
  if (res.status === 401 && !skipAuthRetry && path !== "/auth/refresh") {
    const restored = await tryRefresh();
    if (restored) {
      res = await doFetch();
    } else {
      useAuthStore.getState().clearSession();
    }
  }
  return res;
}

async function parseResponse<TResp>(res: Response): Promise<TResp> {
  if (!res.ok) {
    let bodyJson: unknown = null;
    try {
      bodyJson = await res.json();
    } catch {
      // no JSON body
    }
    const { message, messages, error } = extractMessage(bodyJson);
    throw new ApiError(res.status, message, messages, error);
  }
  if (res.status === 204) return undefined as TResp;
  return (await res.json()) as TResp;
}

async function request<TResp>(path: string, options: RequestOptions = {}): Promise<TResp> {
  const { method = "GET", body, headers = {}, skipAuthRetry } = options;
  const token = useAuthStore.getState().accessToken;

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${useAuthStore.getState().accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const res = await withAuthRetry(doFetch, path, skipAuthRetry);
  return parseResponse<TResp>(res);
}

/** Multipart upload (no JSON Content-Type — the browser sets the multipart boundary itself). */
async function uploadFile<TResp>(path: string, file: File): Promise<TResp> {
  const doFetch = () => {
    const formData = new FormData();
    formData.append("file", file);
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  };

  const res = await withAuthRetry(doFetch, path);
  return parseResponse<TResp>(res);
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ── Auth ─────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: T.AuthUser;
}

export const authApi = {
  register: (input: { email: string; username: string; displayName: string; password: string; invitationCode?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: input, skipAuthRetry: true }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: input, skipAuthRetry: true }),
  refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST", skipAuthRetry: true }),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST", skipAuthRetry: true }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<AuthResponse>("/auth/change-password", { method: "POST", body: input }),
  forgotPassword: (input: { email: string }) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: input, skipAuthRetry: true }),
  resetPassword: (input: { token: string; password: string }) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: input, skipAuthRetry: true }),
};

// ── Catalog ──────────────────────────────────────────────────────────────

export const catalogApi = {
  rarities: () => request<T.Rarity[]>("/rarities"),
  series: () => request<T.CardSeries[]>("/series"),
  cards: (params: { page?: number; pageSize?: number; search?: string; seriesId?: string; rarity?: string } = {}) =>
    request<T.Paginated<T.CardDefinition>>(`/cards${qs(params)}`),
  cardById: (id: string) => request<T.CardDefinition>(`/cards/${id}`),
};

// ── Collection ───────────────────────────────────────────────────────────

export const collectionApi = {
  list: (params: { page?: number; pageSize?: number; seriesId?: string; rarity?: string; state?: string } = {}) =>
    request<T.Paginated<T.CardInstance>>(`/collection${qs(params)}`),
  album: () => request<T.AlbumSeriesEntry[]>("/collection/album"),
  albumSeries: (seriesId: string) => request<T.AlbumSeriesDetail>(`/collection/album/${seriesId}`),
  detail: (instanceId: string) => request<T.CardInstanceDetail>(`/collection/${instanceId}`),
};

// ── Craft ────────────────────────────────────────────────────────────────

export interface CraftableGroup {
  cardDefinition: T.CardDefinition;
  count: number;
  instanceIds: string[];
}

export const craftApi = {
  craftable: () => request<CraftableGroup[]>("/craft/craftable"),
  craft: (cardInstanceIds: string[]) => request<T.CardInstance>("/craft", { method: "POST", body: { cardInstanceIds } }),
};

// ── Card variants (holo/foil) ────────────────────────────────────────────

export const cardVariantsApi = {
  foilable: () => request<CraftableGroup[]>("/card-variants/foilable"),
  foilify: (cardInstanceIds: string[]) => request<T.CardInstance>("/card-variants/foilify", { method: "POST", body: { cardInstanceIds } }),
};

// ── Boosters ─────────────────────────────────────────────────────────────

export const boostersApi = {
  list: () => request<T.BoosterDefinition[]>("/boosters"),
  history: (params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<T.BoosterOpening>>(`/boosters/history${qs(params)}`),
  open: (boosterSlug: string, idempotencyKey: string) =>
    request<T.BoosterOpening>("/boosters/open", {
      method: "POST",
      body: { boosterSlug },
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  freeStatus: () => request<T.FreeBoosterStatus>("/boosters/free/status"),
  claimFree: () => request<T.BoosterOpening>("/boosters/free/claim", { method: "POST" }),
};

// ── Market ───────────────────────────────────────────────────────────────

export const marketApi = {
  listings: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      seriesId?: string;
      rarity?: string;
      listingType?: T.MarketListingType;
      sort?: "price_asc" | "price_desc" | "recent";
    } = {},
  ) => request<T.Paginated<T.MarketListing>>(`/market/listings${qs(params)}`),
  listingById: (id: string) => request<T.MarketListing>(`/market/listings/${id}`),
  create: (input: {
    cardInstanceId: string;
    priceCr: number;
    listingType?: T.MarketListingType;
    durationHours?: number;
  }) => request<T.MarketListing>("/market/listings", { method: "POST", body: input }),
  buy: (id: string) => request<unknown>(`/market/listings/${id}/buy`, { method: "POST" }),
  bid: (id: string, amountCr: number) =>
    request<T.MarketListing>(`/market/listings/${id}/bid`, { method: "POST", body: { amountCr } }),
  settle: (id: string) => request<T.MarketListing>(`/market/listings/${id}/settle`, { method: "POST" }),
  cancel: (id: string) => request<T.MarketListing>(`/market/listings/${id}`, { method: "DELETE" }),
  myTransactions: (params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<unknown>>(`/market/transactions${qs(params)}`),
  priceHistory: (cardDefinitionId: string, days = 30) =>
    request<T.PriceHistoryPoint[]>(`/market/price-history/${cardDefinitionId}${qs({ days })}`),
};

// ── Trading ──────────────────────────────────────────────────────────────

export const tradesApi = {
  create: (input: {
    recipientUsername: string;
    offeredCardInstanceIds: string[];
    requestedCardInstanceIds: string[];
    initiatorCr?: number;
    recipientCr?: number;
    message?: string;
    expiresInHours?: number;
  }) => request<T.Trade>("/trades", { method: "POST", body: input }),
  counter: (
    id: string,
    input: {
      offeredCardInstanceIds: string[];
      requestedCardInstanceIds: string[];
      initiatorCr?: number;
      recipientCr?: number;
      message?: string;
      expiresInHours?: number;
    },
  ) => request<T.Trade>(`/trades/${id}/counter`, { method: "POST", body: input }),
  list: (direction: "sent" | "received" | "all" = "all", status?: string) =>
    request<T.Trade[]>(`/trades${qs({ direction, status })}`),
  getById: (id: string) => request<T.Trade>(`/trades/${id}`),
  accept: (id: string) => request<T.Trade>(`/trades/${id}/accept`, { method: "POST" }),
  reject: (id: string) => request<T.Trade>(`/trades/${id}/reject`, { method: "POST" }),
  cancel: (id: string) => request<T.Trade>(`/trades/${id}/cancel`, { method: "POST" }),
};

// ── Duels ────────────────────────────────────────────────────────────────

export const duelsApi = {
  create: (input: { opponentUsername: string; cardInstanceId: string; wagerCr: number; message?: string }) =>
    request<T.Duel>("/duels", { method: "POST", body: input }),
  list: (direction: "sent" | "received" | "all" = "all", status?: string) =>
    request<T.Duel[]>(`/duels${qs({ direction, status })}`),
  getById: (id: string) => request<T.Duel>(`/duels/${id}`),
  accept: (id: string, cardInstanceId: string) => request<T.Duel>(`/duels/${id}/accept`, { method: "POST", body: { cardInstanceId } }),
  decline: (id: string) => request<{ declined: boolean }>(`/duels/${id}/decline`, { method: "POST" }),
  cancel: (id: string) => request<{ cancelled: boolean }>(`/duels/${id}/cancel`, { method: "POST" }),
};

// ── Wanted listings ─────────────────────────────────────────────────────

export const wantedApi = {
  create: (input: { cardDefinitionId: string; note?: string }) =>
    request<T.WantedListing>("/wanted", { method: "POST", body: input }),
  list: (params: { page?: number; pageSize?: number; cardDefinitionId?: string; search?: string } = {}) =>
    request<T.Paginated<T.WantedListing>>(`/wanted${qs(params)}`),
  mine: () => request<T.WantedListing[]>("/wanted/mine"),
  fulfill: (id: string) => request<T.WantedListing>(`/wanted/${id}/fulfill`, { method: "POST" }),
  cancel: (id: string) => request<T.WantedListing>(`/wanted/${id}/cancel`, { method: "POST" }),
};

// ── Guilds ───────────────────────────────────────────────────────────────

export const guildsApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<T.Guild>>(`/guilds${qs(params)}`),
  leaderboard: (limit = 50) => request<T.GuildLeaderboardEntry[]>(`/guilds/leaderboard${qs({ limit })}`),
  mine: () => request<T.Guild | null>("/guilds/mine"),
  getById: (id: string) => request<T.Guild>(`/guilds/${id}`),
  create: (input: { name: string; tag: string; description?: string }) =>
    request<T.Guild>("/guilds", { method: "POST", body: input }),
  join: (id: string) => request<T.Guild>(`/guilds/${id}/join`, { method: "POST" }),
  leave: () => request<{ left: boolean }>("/guilds/leave", { method: "POST" }),
  kick: (id: string, userId: string) => request<T.Guild>(`/guilds/${id}/members/${userId}/kick`, { method: "POST" }),
  promote: (id: string, userId: string) => request<T.Guild>(`/guilds/${id}/members/${userId}/promote`, { method: "POST" }),
  demote: (id: string, userId: string) => request<T.Guild>(`/guilds/${id}/members/${userId}/demote`, { method: "POST" }),
  transferLeadership: (id: string, userId: string) =>
    request<T.Guild>(`/guilds/${id}/members/${userId}/transfer-leadership`, { method: "POST" }),
  disband: (id: string) => request<{ disbanded: boolean }>(`/guilds/${id}`, { method: "DELETE" }),
  messages: (id: string, limit = 50) => request<T.GuildMessage[]>(`/guilds/${id}/messages${qs({ limit })}`),
  postMessage: (id: string, body: string) => request<T.GuildMessage>(`/guilds/${id}/messages`, { method: "POST", body: { body } }),
  activity: (id: string, limit = 30) => request<T.GuildActivityEvent[]>(`/guilds/${id}/activity${qs({ limit })}`),
};

// ── Seasonal quests ──────────────────────────────────────────────────────

export const questsApi = {
  active: () => request<T.ActiveQuest | null>("/quests/active"),
  claimStep: (stepId: string) => request<unknown>(`/quests/steps/${stepId}/claim`, { method: "POST" }),
};

// ── Site announcement ────────────────────────────────────────────────────

export const announcementApi = {
  active: () => request<T.SiteAnnouncement | null>("/announcement/active"),
};

// ── Live-ops events ──────────────────────────────────────────────────────

export const eventsApi = {
  active: () => request<T.LiveEvent | null>("/events/active"),
};

// ── Seasons (resettable competitive leaderboard) ────────────────────────

export const seasonsApi = {
  active: () => request<T.Season | null>("/seasons/active"),
  leaderboard: (limit = 50) => request<T.SeasonLeaderboard>(`/seasons/leaderboard${qs({ limit })}`),
};

// ── Guild wars (resettable inter-guild competition) ─────────────────────

export const guildWarsApi = {
  active: () => request<T.GuildWarPeriod | null>("/guild-wars/active"),
  leaderboard: (limit = 50) => request<T.GuildWarLeaderboard>(`/guild-wars/leaderboard${qs({ limit })}`),
};

// ── Season pass (per-season milestone rewards) ───────────────────────────

export const seasonPassApi = {
  tiers: () => request<T.SeasonPassBoard>("/season-pass/tiers"),
  claim: (tierId: string) => request<{ id: string; tierId: string; leveledUp: boolean }>(`/season-pass/tiers/${tierId}/claim`, { method: "POST" }),
};

// ── Users ────────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => request<T.Me>("/me"),
  updateMe: (input: unknown) => request<T.Me>("/me", { method: "PATCH", body: input }),
  uploadAvatar: (file: File) => uploadFile<T.Me>("/me/avatar", file),
  publicProfile: (username: string) => request<T.PublicProfile>(`/users/${username}`),
  collection: (username: string, params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<T.CardInstance>>(`/users/${username}/collection${qs(params)}`),
  addFavorite: (cardDefinitionId: string) =>
    request<T.CardDefinition[]>("/me/favorites", { method: "POST", body: { cardDefinitionId } }),
  removeFavorite: (cardDefinitionId: string) =>
    request<T.CardDefinition[]>(`/me/favorites/${cardDefinitionId}`, { method: "DELETE" }),
  search: (q: string) =>
    request<{ username: string; displayName: string; avatarUrl: string | null }[]>(`/users/search${qs({ q })}`),
};

// ── Profile banners ──────────────────────────────────────────────────────

export const profileBannersApi = {
  catalog: () => request<T.ProfileBanner[]>("/profile-banners"),
  mine: () => request<{ unlocked: T.ProfileBanner[]; active: T.ProfileBanner | null }>("/profile-banners/mine"),
  setActive: (bannerId: string | null) =>
    request<{ unlocked: T.ProfileBanner[]; active: T.ProfileBanner | null }>("/profile-banners/active", { method: "POST", body: { bannerId } }),
};

export const profileTitlesApi = {
  catalog: () => request<T.ProfileTitle[]>("/profile-titles"),
  mine: () => request<{ unlocked: T.ProfileTitle[]; active: T.ProfileTitle | null }>("/profile-titles/mine"),
  setActive: (titleId: string | null) =>
    request<{ unlocked: T.ProfileTitle[]; active: T.ProfileTitle | null }>("/profile-titles/active", { method: "POST", body: { titleId } }),
};

// ── Personal stats ───────────────────────────────────────────────────────

export const statsApi = {
  mine: () => request<T.PersonalStats>("/stats/me"),
};

// ── Leaderboard ──────────────────────────────────────────────────────────

export const leaderboardApi = {
  top: (limit = 50, sortBy: T.LeaderboardSort = "xp", scope: "all" | "friends" = "all") =>
    request<T.LeaderboardEntry[]>(`/leaderboard${qs({ limit, sortBy, scope: scope === "friends" ? scope : undefined })}`),
};

// ── Activity feed ────────────────────────────────────────────────────────

export const activityApi = {
  feed: (limit = 30, scope: "all" | "friends" = "all") => request<T.ActivityEvent[]>(`/activity${qs({ limit, scope: scope === "friends" ? scope : undefined })}`),
};

// ── Friends ──────────────────────────────────────────────────────────────

export const friendsApi = {
  list: () => request<T.Friend[]>("/friends"),
  requests: (direction: "incoming" | "outgoing") => request<T.FriendRequest[]>(`/friends/requests${qs({ direction })}`),
  send: (username: string) => request<{ id: string; status: string }>("/friends/requests", { method: "POST", body: { username } }),
  accept: (id: string) => request<{ id: string; status: string }>(`/friends/requests/${id}/accept`, { method: "POST" }),
  declineOrCancel: (id: string) => request<{ removed: boolean }>(`/friends/requests/${id}`, { method: "DELETE" }),
  remove: (friendshipId: string) => request<{ removed: boolean }>(`/friends/${friendshipId}`, { method: "DELETE" }),
};

// ── Missions & achievements ─────────────────────────────────────────────

export const missionsApi = {
  list: () => request<T.MissionProgress[]>("/missions"),
  claim: (userMissionId: string) => request<T.LevelUpInfo>(`/missions/${userMissionId}/claim`, { method: "POST" }),
  achievements: () => request<T.AchievementProgress[]>("/achievements"),
  claimAchievement: (achievementId: string) =>
    request<T.LevelUpInfo>(`/achievements/${achievementId}/claim`, { method: "POST" }),
};

// ── Wallet ───────────────────────────────────────────────────────────────

export const walletApi = {
  get: () => request<{ balance: number; currency: "CR" }>("/wallet"),
  transactions: (params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<T.WalletTransaction>>(`/wallet/transactions${qs(params)}`),
  dailyRewardStatus: () =>
    request<{ claimedToday: boolean; currentStreak: number; nextMultiplier: number }>("/wallet/daily-reward"),
  claimDailyReward: () =>
    request<{
      rewardCr: number;
      rewardXp: number;
      streak: number;
      multiplier: number;
      balanceAfter: number;
      leveledUp: boolean;
      newLevel: number;
      newGrade: string;
    }>("/wallet/daily-reward/claim", {
      method: "POST",
    }),
};

// ── Notifications ────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<T.AppNotification> & { unreadCount: number }>(`/notifications${qs(params)}`),
  markRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "POST" }),
};

// ── Social ───────────────────────────────────────────────────────────────

export const socialApi = {
  fileReport: (input: { targetUserId: string; reason: string; details?: string }) =>
    request<unknown>("/reports", { method: "POST", body: input }),
};

// ── Admin ────────────────────────────────────────────────────────────────

export const adminApi = {
  uploadImage: (file: File) => uploadFile<{ url: string; filename: string }>("/admin/uploads", file),
  listSeries: () => request<T.CardSeries[]>("/admin/series"),
  createSeries: (input: unknown) => request<T.CardSeries>("/admin/series", { method: "POST", body: input }),
  updateSeries: (id: string, input: unknown) =>
    request<T.CardSeries>(`/admin/series/${id}`, { method: "PATCH", body: input }),

  listCards: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      seriesId?: string;
      rarity?: string;
      category?: string;
      status?: string;
      sortBy?: "rarity" | "name" | "status" | "newest";
    } = {},
  ) => request<{ items: T.CardDefinition[]; total: number }>(`/admin/cards${qs(params)}`),
  createCard: (input: unknown) => request<T.CardDefinition>("/admin/cards", { method: "POST", body: input }),
  updateCard: (id: string, input: unknown) =>
    request<T.CardDefinition>(`/admin/cards/${id}`, { method: "PATCH", body: input }),
  publishCard: (id: string) => request<T.CardDefinition>(`/admin/cards/${id}/publish`, { method: "POST" }),
  archiveCard: (id: string) => request<T.CardDefinition>(`/admin/cards/${id}/archive`, { method: "POST" }),
  deleteCard: (id: string, cascade: boolean) =>
    request<{ deleted: boolean; instancesRemoved: number }>(`/admin/cards/${id}${cascade ? "?cascade=true" : ""}`, { method: "DELETE" }),

  listBoosters: () => request<unknown[]>("/admin/boosters"),
  createBooster: (input: unknown) => request<T.BoosterDefinition>("/admin/boosters", { method: "POST", body: input }),
  updateBooster: (id: string, input: unknown) =>
    request<T.BoosterDefinition>(`/admin/boosters/${id}`, { method: "PATCH", body: input }),
  publishPool: (id: string, input: unknown) => request<unknown>(`/admin/boosters/${id}/pool`, { method: "POST", body: input }),

  listMissions: () => request<T.Mission[]>("/admin/missions"),
  createMission: (input: unknown) => request<T.Mission>("/admin/missions", { method: "POST", body: input }),
  updateMission: (id: string, input: unknown) => request<T.Mission>(`/admin/missions/${id}`, { method: "PATCH", body: input }),

  listAchievements: () => request<T.Achievement[]>("/admin/achievements"),
  createAchievement: (input: unknown) => request<T.Achievement>("/admin/achievements", { method: "POST", body: input }),
  updateAchievement: (id: string, input: unknown) =>
    request<T.Achievement>(`/admin/achievements/${id}`, { method: "PATCH", body: input }),

  listProfileBanners: () => request<T.ProfileBanner[]>("/admin/profile-banners"),
  createProfileBanner: (input: { slug: string; name: string; colorFrom: string; colorTo: string; icon: string }) =>
    request<T.ProfileBanner>("/admin/profile-banners", { method: "POST", body: input }),

  listProfileTitles: () => request<T.ProfileTitle[]>("/admin/profile-titles"),
  createProfileTitle: (input: { slug: string; label: string }) =>
    request<T.ProfileTitle>("/admin/profile-titles", { method: "POST", body: input }),

  listQuests: () => request<T.AdminQuest[]>("/admin/quests"),
  createQuest: (input: unknown) => request<T.AdminQuest>("/admin/quests", { method: "POST", body: input }),
  archiveQuest: (id: string) => request<T.AdminQuest>(`/admin/quests/${id}/archive`, { method: "PATCH" }),

  getAnnouncement: () => request<T.AdminSiteAnnouncement | null>("/admin/announcement"),
  upsertAnnouncement: (input: { message: string; isActive: boolean }) =>
    request<T.AdminSiteAnnouncement>("/admin/announcement", { method: "POST", body: input }),

  listEvents: () => request<T.LiveEvent[]>("/admin/events"),
  createEvent: (input: unknown) => request<T.LiveEvent>("/admin/events", { method: "POST", body: input }),
  updateEvent: (id: string, input: unknown) => request<T.LiveEvent>(`/admin/events/${id}`, { method: "PATCH", body: input }),

  listSeasons: () => request<T.Season[]>("/admin/seasons"),
  startSeason: (name: string) => request<T.Season>("/admin/seasons", { method: "POST", body: { name } }),
  endActiveSeason: () => request<T.Season>("/admin/seasons/end-active", { method: "POST" }),

  listGuildWars: () => request<T.GuildWarPeriod[]>("/admin/guild-wars"),
  startGuildWar: (name: string) => request<T.GuildWarPeriod>("/admin/guild-wars", { method: "POST", body: { name } }),
  endActiveGuildWar: () => request<T.GuildWarPeriod>("/admin/guild-wars/end-active", { method: "POST" }),

  listSeasonPassTiers: () => request<T.AdminSeasonPassBoard>("/admin/season-pass/tiers"),
  createSeasonPassTier: (input: { tier: number; pointsRequired: number; rewardCr?: number; rewardXp?: number; rewardLabel?: string }) =>
    request<T.AdminSeasonPassTier>("/admin/season-pass/tiers", { method: "POST", body: input }),
  updateSeasonPassTier: (id: string, input: { pointsRequired?: number; rewardCr?: number; rewardXp?: number; rewardLabel?: string }) =>
    request<T.AdminSeasonPassTier>(`/admin/season-pass/tiers/${id}`, { method: "PATCH", body: input }),

  listGrades: () => request<T.Grade[]>("/admin/grades"),
  createGrade: (input: unknown) => request<T.Grade>("/admin/grades", { method: "POST", body: input }),
  updateGrade: (id: string, input: unknown) => request<T.Grade>(`/admin/grades/${id}`, { method: "PATCH", body: input }),
  deleteGrade: (id: string) => request<{ deleted: boolean }>(`/admin/grades/${id}`, { method: "DELETE" }),

  listInvitations: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: T.Invitation[]; total: number }>(`/admin/invitations${qs(params)}`),
  createInvitation: (input: unknown) => request<T.Invitation>("/admin/invitations", { method: "POST", body: input }),

  listUsers: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: T.AdminUserRow[]; total: number }>(`/admin/users${qs(params)}`),
  suspendUser: (id: string) => request<T.AdminUserRow>(`/admin/users/${id}/suspend`, { method: "POST" }),
  reactivateUser: (id: string) => request<T.AdminUserRow>(`/admin/users/${id}/reactivate`, { method: "POST" }),
  adjustWallet: (id: string, input: { amount: number; reason?: string }) =>
    request<{ balance: number }>(`/admin/users/${id}/wallet-adjustment`, { method: "POST", body: input }),
  grantCard: (id: string, input: { cardDefinitionId: string; quantity?: number }) =>
    request<{ granted: number; cardDefinitionId: string }>(`/admin/users/${id}/grant-card`, { method: "POST", body: input }),
  resetUserCards: (id: string) =>
    request<{ instancesRemoved: number }>(`/admin/users/${id}/reset-cards`, { method: "POST" }),
  deleteUser: (id: string) => request<{ deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),

  listReports: (params: { status?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: T.Report[]; total: number }>(`/admin/reports${qs(params)}`),
  resolveReport: (id: string, status: "RESOLVED" | "DISMISSED") =>
    request<T.Report>(`/admin/reports/${id}/resolve`, { method: "POST", body: { status } }),

  walletTransactions: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; total: number }>(`/admin/wallet-transactions${qs(params)}`),
  marketTransactions: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; total: number }>(`/admin/market-transactions${qs(params)}`),
  auditLog: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: T.AuditLogEntry[]; total: number }>(`/admin/audit-log${qs(params)}`),
};

export { request };
