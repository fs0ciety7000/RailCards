"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, CrAmount } from "@railcards/ui";
import { useAuthStore } from "@/lib/auth-store";
import { usersApi, notificationsApi, authApi } from "@/lib/api";
import { useNotificationsSocket } from "@/lib/use-notifications-socket";

const PRIMARY_TABS = [
  { href: "/home", label: "Accueil", icon: "🏠" },
  { href: "/collection", label: "Collection", icon: "🗂️" },
  { href: "/market", label: "Marché", icon: "💱" },
  { href: "/trades", label: "Échanges", icon: "🔄" },
  { href: "/profile", label: "Profil", icon: "👤" },
];

const SECONDARY_LINKS = [
  { href: "/missions", label: "Missions & hauts faits" },
  { href: "/notifications", label: "Notifications" },
  { href: "/boosters/history", label: "Historique boosters" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);

  useNotificationsSocket();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me, enabled: !!user });
  const notifQuery = useQuery({
    queryKey: ["notifications", "preview"],
    queryFn: () => notificationsApi.list({ page: 1, pageSize: 1 }),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // best-effort: clear the local session regardless
    }
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-rc-night bg-rail-lines text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-rc-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/home" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-rc-accent">
            <span aria-hidden="true">🚆</span> RailCards
          </Link>
          <div className="flex items-center gap-3">
            {meQuery.data && (
              <div className="hidden items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-sm sm:flex">
                <span aria-hidden="true">💰</span>
                <CrAmount value={meQuery.data.walletBalance} />
              </div>
            )}
            <Link
              href="/notifications"
              className="relative rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
              aria-label="Notifications"
            >
              <span aria-hidden="true">🔔</span>
              {!!notifQuery.data?.unreadCount && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rc-accent px-1 text-[10px] font-bold text-rc-night">
                  {notifQuery.data.unreadCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-rc-accent text-sm font-bold text-rc-night"
                aria-hidden="true"
              >
                {(meQuery.data?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{meQuery.data?.displayName ?? user?.username}</span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            role="menu"
            aria-label="Menu secondaire"
            className="border-t border-white/10 bg-rc-night-light px-4 py-3"
          >
            <ul className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:flex-wrap">
              {SECONDARY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {user?.role === "ADMIN" && (
                <li>
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-rc-accent hover:bg-white/10"
                  >
                    Administration
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rc-danger hover:bg-white/10"
                >
                  Se déconnecter
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 sm:pb-10 sm:pl-20">{children}</main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-rc-night-dark/95 backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex max-w-5xl justify-between">
          {PRIMARY_TABS.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                    active ? "text-rc-accent" : "text-white/60",
                  )}
                >
                  <span className="text-lg" aria-hidden="true">
                    {tab.icon}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:top-[57px] sm:flex sm:w-16 sm:flex-col sm:items-center sm:gap-4 sm:border-r sm:border-white/10 sm:bg-rc-night-dark/60 sm:py-4">
        {PRIMARY_TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              title={tab.label}
              className={cn(
                "flex h-11 w-11 flex-col items-center justify-center rounded-xl text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                active ? "bg-rc-accent/15 text-rc-accent" : "text-white/60 hover:bg-white/10",
              )}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span className="sr-only">{tab.label}</span>
            </Link>
          );
        })}
      </aside>
    </div>
  );
}
