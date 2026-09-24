"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  ClipboardList,
  Crown,
  Folder,
  Home,
  LogOut,
  Menu,
  Radio,
  Repeat,
  Shield,
  Sparkles,
  Swords,
  TrainFront,
  Trophy,
  User,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn, CrAmount } from "@railcards/ui";
import { useAuthStore } from "@/lib/auth-store";
import { usersApi, notificationsApi, authApi } from "@/lib/api";
import { useNotificationsSocket } from "@/lib/use-notifications-socket";
import { LiveBanners } from "@/components/LiveBanners";

const PRIMARY_TABS = [
  { href: "/home", label: "Accueil", icon: Home },
  { href: "/collection", label: "Collection", icon: Folder },
  { href: "/market", label: "Marché", icon: ArrowLeftRight },
  { href: "/trades", label: "Échanges", icon: Repeat },
  { href: "/duels", label: "Duels", icon: Swords },
  { href: "/profile", label: "Profil", icon: User },
];

const SECONDARY_LINKS = [
  { href: "/missions", label: "Missions & hauts faits", icon: Trophy },
  { href: "/quests", label: "Quête saisonnière", icon: BookOpen },
  { href: "/guilds", label: "Guildes", icon: Users },
  { href: "/friends", label: "Amis", icon: UserPlus },
  { href: "/wanted", label: "Petites annonces", icon: ClipboardList },
  { href: "/activity", label: "Fil d'activité", icon: Radio },
  { href: "/leaderboard", label: "Classement", icon: Crown },
  { href: "/season-pass", label: "Pass de saison", icon: Sparkles },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/lore", label: "Livre de lore", icon: BookMarked },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/boosters/history", label: "Historique boosters", icon: Repeat },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const navLayoutId = useId();

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
      <header className="sticky top-0 z-30 border-b border-rc-border bg-rc-night/85 backdrop-blur-md sm:ml-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/home"
            className="font-display flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:hidden"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-rc-accent text-rc-night"
            >
              <TrainFront className="h-4 w-4" strokeWidth={2.5} />
            </span>
            RailCards
          </Link>
          <span className="hidden text-sm font-semibold text-white/50 sm:block">
            {PRIMARY_TABS.find((t) => pathname === t.href || pathname?.startsWith(`${t.href}/`))?.label ?? "RailCards"}
          </span>
          <div className="flex items-center gap-2">
            {meQuery.data && (
              <div className="hidden items-center gap-1.5 rounded-full border border-rc-border bg-white/[0.04] px-3 py-1.5 text-sm sm:flex">
                <Wallet className="h-3.5 w-3.5 text-rc-accent" aria-hidden="true" />
                <CrAmount value={meQuery.data.walletBalance} className="text-rc-accent" />
              </div>
            )}
            <Link
              href="/notifications"
              className="relative rounded-full p-2 text-white/70 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
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
              className="flex items-center gap-2 rounded-full border border-rc-border bg-white/[0.04] py-1 pl-1 pr-3 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-rc-accent text-sm font-bold text-rc-night"
                aria-hidden="true"
              >
                {(meQuery.data?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{meQuery.data?.displayName ?? user?.username}</span>
              <Menu className="h-4 w-4 text-white/50 sm:hidden" aria-hidden="true" />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            role="menu"
            aria-label="Menu secondaire"
            className="border-t border-rc-border bg-rc-night-light px-4 py-3"
          >
            <ul className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:flex-wrap">
              {SECONDARY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.06] hover:text-white"
                  >
                    <link.icon className="h-4 w-4 text-white/40" aria-hidden="true" />
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
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rc-accent hover:bg-white/[0.06]"
                  >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    Administration
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rc-danger hover:bg-white/[0.06]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Se déconnecter
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <LiveBanners />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:pb-12 sm:pl-[calc(15rem+1rem)]">{children}</main>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rc-border bg-rc-night-dark/95 backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex max-w-6xl justify-between">
          {PRIMARY_TABS.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                    active ? "text-rc-accent" : "text-white/55",
                  )}
                >
                  <tab.icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.25 : 2} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: labeled sidebar with a sliding active-pill indicator */}
      <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:top-0 sm:z-20 sm:flex sm:w-60 sm:flex-col sm:border-r sm:border-rc-border sm:bg-rc-night-dark/70 sm:py-4">
        <Link href="/home" className="font-display flex items-center gap-2 px-5 pb-5 text-lg font-bold tracking-tight text-white">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-rc-accent text-rc-night shadow-rc-glow"
          >
            <TrainFront className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </span>
          RailCards
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 px-3">
          {PRIMARY_TABS.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                  active ? "text-white" : "text-white/55 hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`${navLayoutId}-sidebar-indicator`}
                    className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-inset ring-rc-accent/25"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <tab.icon className="relative z-10 h-[18px] w-[18px] shrink-0" aria-hidden="true" strokeWidth={active ? 2.25 : 2} />
                <span className="relative z-10">{tab.label}</span>
                {active && <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-rc-accent" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 px-3 pt-2">
          {SECONDARY_LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                  active ? "text-white" : "text-white/40 hover:text-white/80",
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-rc-accent/90 hover:text-rc-accent"
            >
              <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
              Administration
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
