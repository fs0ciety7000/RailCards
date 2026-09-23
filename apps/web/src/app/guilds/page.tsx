"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Crown, Layers, Plus, Sparkles, Users } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Skeleton, Tabs } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { guildsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { Guild, GuildLeaderboardEntry } from "@/lib/types";

function GuildCard({ guild }: { guild: Guild }) {
  return (
    <Link href={`/guilds/${guild.id}`} className="block">
      <Card className="transition-colors hover:bg-white/[0.04]">
        <CardBody className="flex items-center gap-3 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rc-accent/15 text-sm font-bold text-rc-accent">
            {guild.tag}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{guild.name}</p>
            <p className="truncate text-xs text-white/50">
              Chef @{guild.leader.username} · niveau {guild.level}
            </p>
          </div>
          <Badge className="flex shrink-0 items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {guild.memberCount}/{guild.maxMembers}
          </Badge>
        </CardBody>
      </Card>
    </Link>
  );
}

const RANK_TONE: Record<number, string> = { 1: "text-amber-300", 2: "text-slate-300", 3: "text-orange-400" };

function GuildLeaderboardRow({ entry }: { entry: GuildLeaderboardEntry }) {
  return (
    <Link href={`/guilds/${entry.id}`} className="block">
      <Card className="transition-colors hover:bg-white/[0.04]">
        <CardBody className="flex items-center gap-3 py-3">
          <div className="flex w-6 shrink-0 justify-center">
            {entry.rank <= 3 ? (
              <Crown className={`h-5 w-5 ${RANK_TONE[entry.rank]}`} aria-hidden="true" />
            ) : (
              <span className="text-sm font-semibold text-white/40">{entry.rank}</span>
            )}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rc-accent/15 text-xs font-bold text-rc-accent">
            {entry.tag}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{entry.name}</p>
            <p className="text-xs text-white/50">{entry.memberCount} membre(s)</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-white/60">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {entry.totalXp} XP
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" aria-hidden="true" />
              {entry.totalUniqueCards}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function GuildsContent() {
  const [tab, setTab] = useState<"browse" | "leaderboard">("browse");
  const [search, setSearch] = useState("");

  const mineQuery = useQuery({ queryKey: ["guilds", "mine"], queryFn: guildsApi.mine });
  const browseQuery = useQuery({
    queryKey: ["guilds", "browse", search],
    queryFn: () => guildsApi.list({ search: search || undefined, pageSize: 50 }),
    enabled: tab === "browse",
  });
  const leaderboardQuery = useQuery({
    queryKey: ["guilds", "leaderboard"],
    queryFn: () => guildsApi.leaderboard(50),
    enabled: tab === "leaderboard",
  });

  return (
    <div>
      <PageHeader
        title="Guildes"
        description="Rejoignez ou formez un petit groupe de joueurs et grimpez ensemble le classement."
        actions={
          !mineQuery.data && (
            <Link href="/guilds/new">
              <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                Créer une guilde
              </Button>
            </Link>
          )
        }
      />

      {mineQuery.data && (
        <Card className="mb-5 border-rc-accent/30 bg-rc-accent/5">
          <CardBody className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rc-accent">Votre guilde</p>
              <p className="mt-0.5 font-semibold text-white">
                [{mineQuery.data.tag}] {mineQuery.data.name}
              </p>
            </div>
            <Link href={`/guilds/${mineQuery.data.id}`}>
              <Button size="sm" variant="outline">
                Voir
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "browse", label: "Parcourir" },
            { id: "leaderboard", label: "Classement" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as "browse" | "leaderboard")}
        />
      </div>

      {tab === "browse" && (
        <>
          <Input
            aria-label="Rechercher une guilde"
            placeholder="Rechercher par nom ou tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 w-full sm:w-72"
          />
          {browseQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[66px] w-full" />
              ))}
            </div>
          ) : browseQuery.isError ? (
            <ErrorState description={getErrorMessage(browseQuery.error)} action={<Button onClick={() => browseQuery.refetch()}>Réessayer</Button>} />
          ) : browseQuery.data!.items.length === 0 ? (
            <EmptyState icon={<Users />} title="Aucune guilde" description="Soyez le premier à en fonder une." />
          ) : (
            <Stagger className="space-y-2">
              {browseQuery.data!.items.map((guild) => (
                <StaggerItem key={guild.id}>
                  <GuildCard guild={guild} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      {tab === "leaderboard" &&
        (leaderboardQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[66px] w-full" />
            ))}
          </div>
        ) : leaderboardQuery.isError ? (
          <ErrorState description={getErrorMessage(leaderboardQuery.error)} />
        ) : leaderboardQuery.data!.length === 0 ? (
          <EmptyState icon={<Crown />} title="Aucune guilde classée" description="Revenez plus tard." />
        ) : (
          <Stagger className="space-y-2">
            {leaderboardQuery.data!.map((entry) => (
              <StaggerItem key={entry.id}>
                <GuildLeaderboardRow entry={entry} />
              </StaggerItem>
            ))}
          </Stagger>
        ))}
    </div>
  );
}

export default function GuildsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <GuildsContent />
      </AppShell>
    </RequireAuth>
  );
}
