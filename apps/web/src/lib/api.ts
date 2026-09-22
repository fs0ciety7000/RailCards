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

  let res = await doFetch();

  if (res.status === 401 && !skipAuthRetry && path !== "/auth/refresh") {
    const restored = await tryRefresh();
    if (restored) {
      res = await doFetch();
    } else {
      useAuthStore.getState().clearSession();
    }
  }

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
  detail: (instanceId: string) => request<T.CardInstanceDetail>(`/collection/${instanceId}`),
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
      sort?: "price_asc" | "price_desc" | "recent";
    } = {},
  ) => request<T.Paginated<T.MarketListing>>(`/market/listings${qs(params)}`),
  listingById: (id: string) => request<T.MarketListing>(`/market/listings/${id}`),
  create: (input: { cardInstanceId: string; priceCr: number }) =>
    request<T.MarketListing>("/market/listings", { method: "POST", body: input }),
  buy: (id: string) => request<unknown>(`/market/listings/${id}/buy`, { method: "POST" }),
  cancel: (id: string) => request<T.MarketListing>(`/market/listings/${id}`, { method: "DELETE" }),
  myTransactions: (params: { page?: number; pageSize?: number } = {}) =>
    request<T.Paginated<unknown>>(`/market/transactions${qs(params)}`),
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
  list: (direction: "sent" | "received" | "all" = "all", status?: string) =>
    request<T.Trade[]>(`/trades${qs({ direction, status })}`),
  getById: (id: string) => request<T.Trade>(`/trades/${id}`),
  accept: (id: string) => request<T.Trade>(`/trades/${id}/accept`, { method: "POST" }),
  reject: (id: string) => request<T.Trade>(`/trades/${id}/reject`, { method: "POST" }),
  cancel: (id: string) => request<T.Trade>(`/trades/${id}/cancel`, { method: "POST" }),
};

// ── Users ────────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => request<T.Me>("/me"),
  publicProfile: (username: string) => request<T.PublicProfile>(`/users/${username}`),
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
  dailyRewardStatus: () => request<{ claimedToday: boolean; currentStreak: number }>("/wallet/daily-reward"),
  claimDailyReward: () =>
    request<{ rewardCr: number; streak: number; balanceAfter: number }>("/wallet/daily-reward/claim", {
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
  listSeries: () => request<T.CardSeries[]>("/admin/series"),
  createSeries: (input: unknown) => request<T.CardSeries>("/admin/series", { method: "POST", body: input }),
  updateSeries: (id: string, input: unknown) =>
    request<T.CardSeries>(`/admin/series/${id}`, { method: "PATCH", body: input }),

  listCards: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: T.CardDefinition[]; total: number }>(`/admin/cards${qs(params)}`),
  createCard: (input: unknown) => request<T.CardDefinition>("/admin/cards", { method: "POST", body: input }),
  updateCard: (id: string, input: unknown) =>
    request<T.CardDefinition>(`/admin/cards/${id}`, { method: "PATCH", body: input }),
  publishCard: (id: string) => request<T.CardDefinition>(`/admin/cards/${id}/publish`, { method: "POST" }),
  archiveCard: (id: string) => request<T.CardDefinition>(`/admin/cards/${id}/archive`, { method: "POST" }),

  listBoosters: () => request<unknown[]>("/admin/boosters"),
  createBooster: (input: unknown) => request<T.BoosterDefinition>("/admin/boosters", { method: "POST", body: input }),
  publishPool: (id: string, input: unknown) => request<unknown>(`/admin/boosters/${id}/pool`, { method: "POST", body: input }),

  listInvitations: (params: { page?: number; pageSize?: number } = {}) =>
    request<{ items: T.Invitation[]; total: number }>(`/admin/invitations${qs(params)}`),
  createInvitation: (input: unknown) => request<T.Invitation>("/admin/invitations", { method: "POST", body: input }),

  listUsers: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: T.AdminUserRow[]; total: number }>(`/admin/users${qs(params)}`),
  suspendUser: (id: string) => request<T.AdminUserRow>(`/admin/users/${id}/suspend`, { method: "POST" }),
  reactivateUser: (id: string) => request<T.AdminUserRow>(`/admin/users/${id}/reactivate`, { method: "POST" }),
  adjustWallet: (id: string, input: { amount: number; reason?: string }) =>
    request<{ balance: number }>(`/admin/users/${id}/wallet-adjustment`, { method: "POST", body: input }),

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
