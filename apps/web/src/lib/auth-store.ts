import { create } from "zustand";
import type { AuthUser } from "./types";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** false until the initial silent-refresh attempt on app load has resolved. */
  hydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setHydrated: () => void;
}

// Access token lives in memory only — never persisted to localStorage or a
// cookie the JS layer can read. The refresh token is an httpOnly cookie the
// browser manages automatically.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
  setHydrated: () => set({ hydrated: true }),
}));
