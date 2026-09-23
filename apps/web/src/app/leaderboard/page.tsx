"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Crown, Layers, Medal, Shield, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { Badge, Card, CardBody, EmptyState, ErrorState, Skeleton, Tabs } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { leaderboardApi, seasonsApi, guildWarsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { GuildWarEntry, LeaderboardEntry, LeaderboardSort, SeasonLeaderboardEntry } from "@/lib/types";

const SORT_TABS: { id: LeaderboardSort; label: string }[] = [
  { id: "xp", label: "XP" },
  { id: "cards", label: "Cartes" },
  { id: "albums", label: "Albums complets" },
];

const RANK_TONE: Record<number, string> = {
  1: "text-amber-300",
  2: "text-slate-300",
  3: "text-orange-400",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Medal className={`h-5 w-5 ${RANK_TONE[rank]}`} aria-hidden="true" />;
  }
  return <span className="w-5 text-center text-sm font-semibold text-white/40">{rank}</span>;
}

function Stat({ icon: Icon, value, active }: { icon: typeof Sparkles; value: number | string; active: boolean }) {
  return (
    <span className={`flex items-center gap-1 ${active ? "font-bold text-rc-accent" : "text-white/50"}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}

function LeaderboardRow({ entry, sortBy }: { entry: LeaderboardEntry; sortBy: LeaderboardSort }) {
  return (
    <Link href={`/profile/${entry.username}`} className="block">
      <Card className="transition-colors hover:bg-white/[0.04]">
        <CardBody className="flex items-center gap-3 py-3">
          <div className="flex w-6 shrink-0 justify-center">
            <RankBadge rank={entry.rank} />
          </div>
          <Avatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} isAdmin={entry.role === "ADMIN"} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-white">{entry.displayName}</p>
              {entry.role === "ADMIN" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />}
            </div>
            <p className="truncate text-xs text-white/50">@{entry.username}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone="accent">{entry.grade}</Badge>
            <div className="flex items-center gap-2 text-[11px]">
              <Stat icon={Sparkles} value={`${entry.xp} XP`} active={sortBy === "xp"} />
              <Stat icon={Layers} value={entry.uniqueCardCount} active={sortBy === "cards"} />
              <Stat icon={BookOpen} value={entry.completeSeriesCount} active={sortBy === "albums"} />
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function SeasonRow({ entry }: { entry: SeasonLeaderboardEntry }) {
  return (
    <Link href={`/profile/${entry.username}`} className="block">
      <Card className="transition-colors hover:bg-white/[0.04]">
        <CardBody className="flex items-center gap-3 py-3">
          <div className="flex w-6 shrink-0 justify-center">
            <RankBadge rank={entry.rank} />
          </div>
          <Avatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} isAdmin={entry.role === "ADMIN"} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-white">{entry.displayName}</p>
              {entry.role === "ADMIN" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />}
            </div>
            <p className="truncate text-xs text-white/50">@{entry.username}</p>
          </div>
          <Badge tone="accent" className="flex shrink-0 items-center gap-1">
            <Trophy className="h-3 w-3" aria-hidden="true" />
            {entry.points} pts
          </Badge>
        </CardBody>
      </Card>
    </Link>
  );
}

function GuildWarRow({ entry }: { entry: GuildWarEntry }) {
  return (
    <Link href={`/guilds/${entry.guildId}`} className="block">
      <Card className="transition-colors hover:bg-white/[0.04]">
        <CardBody className="flex items-center gap-3 py-3">
          <div className="flex w-6 shrink-0 justify-center">
            <RankBadge rank={entry.rank} />
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rc-accent/15 text-xs font-bold text-rc-accent">
            {entry.tag}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{entry.name}</p>
            <p className="flex items-center gap-1 text-xs text-white/50">
              <Users className="h-3 w-3" aria-hidden="true" />
              {entry.memberCount} membre(s)
            </p>
          </div>
          <Badge tone="accent" className="flex shrink-0 items-center gap-1">
            <Swords className="h-3 w-3" aria-hidden="true" />
            {entry.points} pts
          </Badge>
        </CardBody>
      </Card>
    </Link>
  );
}

function PermanentLeaderboard() {
  const [sortBy, setSortBy] = useState<LeaderboardSort>("xp");
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", sortBy],
    queryFn: () => leaderboardApi.top(100, sortBy),
  });

  return (
    <div>
      <div className="mb-4">
        <Tabs tabs={SORT_TABS} activeId={sortBy} onChange={(id) => setSortBy(id as LeaderboardSort)} />
      </div>

      {leaderboardQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : leaderboardQuery.isError ? (
        <ErrorState title="Classement indisponible" description={getErrorMessage(leaderboardQuery.error)} />
      ) : (leaderboardQuery.data ?? []).length === 0 ? (
        <EmptyState icon={<Crown />} title="Aucun joueur classé" description="Revenez plus tard." />
      ) : (
        <Stagger className="space-y-2">
          {leaderboardQuery.data!.map((entry) => (
            <StaggerItem key={entry.username}>
              <LeaderboardRow entry={entry} sortBy={sortBy} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function SeasonLeaderboard() {
  const seasonQuery = useQuery({ queryKey: ["seasons", "leaderboard"], queryFn: () => seasonsApi.leaderboard(100) });

  if (seasonQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full" />
        ))}
      </div>
    );
  }
  if (seasonQuery.isError) {
    return <ErrorState title="Classement indisponible" description={getErrorMessage(seasonQuery.error)} />;
  }
  if (!seasonQuery.data?.season) {
    return <EmptyState icon={<Trophy />} title="Aucune saison en cours" description="Revenez lors de la prochaine saison compétitive." />;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-white/60">
        Saison <span className="font-semibold text-white">{seasonQuery.data.season.name}</span> · depuis le{" "}
        {formatDate(seasonQuery.data.season.startedAt)}
      </p>
      {seasonQuery.data.entries.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Aucun point marqué" description="Soyez le premier à marquer des points cette saison." />
      ) : (
        <Stagger className="space-y-2">
          {seasonQuery.data.entries.map((entry) => (
            <StaggerItem key={entry.username}>
              <SeasonRow entry={entry} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function GuildWarLeaderboard() {
  const warQuery = useQuery({ queryKey: ["guild-wars", "leaderboard"], queryFn: () => guildWarsApi.leaderboard(100) });

  if (warQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full" />
        ))}
      </div>
    );
  }
  if (warQuery.isError) {
    return <ErrorState title="Classement indisponible" description={getErrorMessage(warQuery.error)} />;
  }
  if (!warQuery.data?.period) {
    return <EmptyState icon={<Swords />} title="Aucune guerre de guildes en cours" description="Revenez lors de la prochaine guerre." />;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-white/60">
        <span className="font-semibold text-white">{warQuery.data.period.name}</span> · depuis le {formatDate(warQuery.data.period.startedAt)} ·
        récompenses CR au top 3 à la fin de la guerre
      </p>
      {warQuery.data.entries.length === 0 ? (
        <EmptyState icon={<Shield />} title="Aucun point marqué" description="Votre guilde n'a pas encore marqué de points cette guerre." />
      ) : (
        <Stagger className="space-y-2">
          {warQuery.data.entries.map((entry) => (
            <StaggerItem key={entry.guildId}>
              <GuildWarRow entry={entry} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function LeaderboardContent() {
  const [mode, setMode] = useState<"permanent" | "season" | "guild-wars">("permanent");

  return (
    <div>
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "permanent", label: "Classement général" },
            { id: "season", label: "Classement saisonnier" },
            { id: "guild-wars", label: "Guerre de guildes" },
          ]}
          activeId={mode}
          onChange={(id) => setMode(id as "permanent" | "season" | "guild-wars")}
        />
      </div>
      {mode === "permanent" ? <PermanentLeaderboard /> : mode === "season" ? <SeasonLeaderboard /> : <GuildWarLeaderboard />}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="Classement"
          description="Les meilleurs joueurs. Un profil masqué n'apparaît pas ici."
        />
        <LeaderboardContent />
      </AppShell>
    </RequireAuth>
  );
}
