"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Crown, Layers, Medal, Sparkles } from "lucide-react";
import { Badge, Card, CardBody, EmptyState, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { leaderboardApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { LeaderboardEntry } from "@/lib/types";

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

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
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
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {entry.xp} XP
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {entry.uniqueCardCount}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function LeaderboardContent() {
  const leaderboardQuery = useQuery({ queryKey: ["leaderboard"], queryFn: () => leaderboardApi.top(100) });

  if (leaderboardQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full" />
        ))}
      </div>
    );
  }

  if (leaderboardQuery.isError) {
    return <ErrorState title="Classement indisponible" description={getErrorMessage(leaderboardQuery.error)} />;
  }

  const entries = leaderboardQuery.data ?? [];

  if (entries.length === 0) {
    return <EmptyState icon={<Crown />} title="Aucun joueur classé" description="Revenez plus tard." />;
  }

  return (
    <Stagger className="space-y-2">
      {entries.map((entry) => (
        <StaggerItem key={entry.username}>
          <LeaderboardRow entry={entry} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="Classement"
          description="Les meilleurs joueurs, classés par XP. Un profil masqué n'apparaît pas ici."
        />
        <LeaderboardContent />
      </AppShell>
    </RequireAuth>
  );
}
