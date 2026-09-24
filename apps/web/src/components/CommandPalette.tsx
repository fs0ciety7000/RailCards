"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  ClipboardList,
  Crown,
  Folder,
  Gem,
  Gift,
  Home,
  Landmark,
  ListChecks,
  Mail,
  Radio,
  Repeat,
  Search,
  Shield,
  Sparkles,
  Swords,
  Ticket,
  Trophy,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { catalogApi, usersApi } from "@/lib/api";

interface StaticRoute {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const STATIC_ROUTES: StaticRoute[] = [
  { href: "/home", label: "Accueil", icon: Home },
  { href: "/collection", label: "Collection", icon: Folder },
  { href: "/collection/album", label: "Vue album", icon: BookOpen },
  { href: "/collection/missing", label: "Cartes manquantes", icon: ListChecks },
  { href: "/collection/craft", label: "Fusion de cartes", icon: Sparkles },
  { href: "/collection/foil", label: "Variantes foil", icon: Gem },
  { href: "/market", label: "Marché", icon: ArrowLeftRight },
  { href: "/trades", label: "Échanges", icon: Repeat },
  { href: "/duels", label: "Duels", icon: Swords },
  { href: "/profile", label: "Profil", icon: User },
  { href: "/boosters", label: "Ouvrir un booster", icon: Gift },
  { href: "/boosters/history", label: "Historique boosters", icon: Repeat },
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
  { href: "/admin", label: "Administration", icon: Shield, adminOnly: true },
  { href: "/admin/users", label: "Admin — Utilisateurs", icon: Shield, adminOnly: true },
  { href: "/admin/cards", label: "Admin — Cartes", icon: Shield, adminOnly: true },
  { href: "/admin/series", label: "Admin — Séries", icon: Shield, adminOnly: true },
  { href: "/admin/boosters", label: "Admin — Boosters", icon: Shield, adminOnly: true },
  { href: "/admin/missions", label: "Admin — Missions", icon: Shield, adminOnly: true },
  { href: "/admin/quests", label: "Admin — Quêtes", icon: Shield, adminOnly: true },
  { href: "/admin/grades", label: "Admin — Rangs", icon: Shield, adminOnly: true },
  { href: "/admin/invitations", label: "Admin — Invitations", icon: Mail, adminOnly: true },
  { href: "/admin/ledger", label: "Admin — Journal", icon: Landmark, adminOnly: true },
  { href: "/admin/live-ops", label: "Admin — Live Ops", icon: Ticket, adminOnly: true },
  { href: "/admin/reports", label: "Admin — Signalements", icon: Shield, adminOnly: true },
];

type ResultKind = "page" | "card" | "player";

interface FlatResult {
  kind: ResultKind;
  key: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
  avatarLetter?: string;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * App-wide Cmd/Ctrl+K search — pages, catalog cards and players in one box.
 * Pages match locally (no request); cards and players hit the same search
 * endpoints their own pages already use (`catalogApi.cards`, `usersApi.search`),
 * debounced, so this adds no new backend surface.
 */
export function CommandPalette() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // Lets a plain header button (no shared state needed) open the same
    // palette the keyboard shortcut does.
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("railcards:open-command-palette", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("railcards:open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const cardsQuery = useQuery({
    queryKey: ["command-palette", "cards", debounced],
    queryFn: () => catalogApi.cards({ search: debounced, pageSize: 5 }),
    enabled: open && debounced.length >= 2,
  });
  const playersQuery = useQuery({
    queryKey: ["command-palette", "players", debounced],
    queryFn: () => usersApi.search(debounced),
    enabled: open && debounced.length >= 2,
  });

  const pageResults = useMemo<FlatResult[]>(() => {
    const q = normalize(query.trim());
    return STATIC_ROUTES.filter((r) => (!r.adminOnly || user?.role === "ADMIN") && (q.length === 0 || normalize(r.label).includes(q)))
      .slice(0, q.length === 0 ? 8 : 6)
      .map((r) => ({ kind: "page", key: r.href, label: r.label, href: r.href, icon: r.icon }));
  }, [query, user]);

  const cardResults = useMemo<FlatResult[]>(() => {
    if (debounced.length < 2) return [];
    return (cardsQuery.data?.items ?? []).slice(0, 5).map((c) => ({
      kind: "card",
      key: c.id,
      label: c.name,
      sublabel: `${c.series.name} · ${c.rarity.label}`,
      href: `/market?search=${encodeURIComponent(c.name)}`,
      icon: Gem,
    }));
  }, [cardsQuery.data, debounced]);

  const playerResults = useMemo<FlatResult[]>(() => {
    if (debounced.length < 2) return [];
    return (playersQuery.data ?? []).slice(0, 5).map((p) => ({
      kind: "player",
      key: p.username,
      label: p.displayName,
      sublabel: `@${p.username}`,
      href: `/profile/${p.username}`,
      icon: User,
      avatarLetter: p.displayName.slice(0, 1).toUpperCase(),
    }));
  }, [playersQuery.data, debounced]);

  const allResults = useMemo(() => [...pageResults, ...cardResults, ...playerResults], [pageResults, cardResults, playerResults]);

  useEffect(() => {
    setActiveIndex(0);
  }, [allResults.length]);

  function go(result: FlatResult) {
    setOpen(false);
    router.push(result.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = allResults[activeIndex];
      if (result) go(result);
    }
  }

  if (!open) return null;

  const isSearching = debounced.length >= 2 && (cardsQuery.isLoading || playersQuery.isLoading);

  function section(title: string, results: FlatResult[], offset: number) {
    if (results.length === 0) return null;
    return (
      <div className="px-2 pb-2">
        <p className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-white/35">{title}</p>
        {results.map((r, i) => {
          const index = offset + i;
          const active = index === activeIndex;
          return (
            <button
              key={r.key}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => go(r)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                active ? "bg-rc-accent/15 text-white" : "text-white/75 hover:bg-white/[0.05]"
              }`}
            >
              {r.avatarLetter ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rc-accent/20 text-xs font-bold text-rc-accent">
                  {r.avatarLetter}
                </span>
              ) : (
                <r.icon className="h-4 w-4 shrink-0 text-white/45" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.label}</span>
                {r.sublabel && <span className="block truncate text-xs text-white/40">{r.sublabel}</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-rc-border-strong bg-rc-night-light shadow-rc-lg"
      >
        <div className="flex items-center gap-2.5 border-b border-rc-border px-3.5 py-3">
          <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une carte, un joueur, une page…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-rc-border px-1.5 py-0.5 text-[10px] font-semibold text-white/40">Échap</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {section("Pages", pageResults, 0)}
          {section("Cartes", cardResults, pageResults.length)}
          {section("Joueurs", playerResults, pageResults.length + cardResults.length)}
          {isSearching && <p className="px-4 py-3 text-xs text-white/40">Recherche…</p>}
          {!isSearching && allResults.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-white/40">Aucun résultat.</p>
          )}
        </div>
      </div>
    </div>
  );
}
