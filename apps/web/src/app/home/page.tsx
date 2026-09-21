"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, CardBody, CrAmount, EmptyState, ProgressBar, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usersApi, walletApi, missionsApi, notificationsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { NOTIFICATION_LABELS, formatDateTime } from "@/lib/format";

function HomeContent() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const dailyRewardQuery = useQuery({ queryKey: ["wallet", "daily-reward"], queryFn: walletApi.dailyRewardStatus });
  const missionsQuery = useQuery({ queryKey: ["missions"], queryFn: missionsApi.list });
  const notifQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => notificationsApi.list({ page: 1, pageSize: 4 }),
  });

  const claimDailyReward = useMutation({
    mutationFn: walletApi.claimDailyReward,
    onSuccess: (res) => {
      toast.show({
        tone: "success",
        title: "Récompense quotidienne récupérée",
        description: `+${res.rewardCr} CR · série de ${res.streak} jour(s)`,
      });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  const activeMissions = (missionsQuery.data ?? []).filter((m) => !m.claimedAt).slice(0, 3);

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${meQuery.data?.displayName ?? "voyageur"} 👋`}
        description="Voici un aperçu de votre réseau RailCards."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Portefeuille</p>
            {meQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <p className="mt-1 font-display text-3xl font-bold text-rc-accent">
                <CrAmount value={meQuery.data?.walletBalance ?? 0} />
              </p>
            )}
            <p className="mt-1 text-xs text-white/50">
              Niveau {meQuery.data?.level ?? 1} · {meQuery.data?.xp ?? 0} XP
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Récompense quotidienne</p>
            {dailyRewardQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : dailyRewardQuery.data?.claimedToday ? (
              <p className="mt-2 text-sm text-white/70">
                Déjà réclamée aujourd&apos;hui · série de {dailyRewardQuery.data.currentStreak} jour(s) 🔥
              </p>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm text-white/70">Série actuelle : {dailyRewardQuery.data?.currentStreak ?? 0} jour(s)</p>
                <Button size="sm" onClick={() => claimDailyReward.mutate()} loading={claimDailyReward.isPending}>
                  Réclamer
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/boosters">
          <Card className="h-full transition hover:border-rc-accent/50">
            <CardBody className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                🎁
              </span>
              <div>
                <p className="font-semibold text-white">Ouvrir un booster</p>
                <p className="text-xs text-white/50">Tentez votre chance</p>
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/collection">
          <Card className="h-full transition hover:border-rc-accent/50">
            <CardBody className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                🗂️
              </span>
              <div>
                <p className="font-semibold text-white">Ma collection</p>
                <p className="text-xs text-white/50">Voir mes cartes</p>
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/market">
          <Card className="h-full transition hover:border-rc-accent/50">
            <CardBody className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                💱
              </span>
              <div>
                <p className="font-semibold text-white">Le marché</p>
                <p className="text-xs text-white/50">Acheter / vendre</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-white">Missions en cours</p>
              <Link href="/missions" className="text-xs font-semibold text-rc-accent hover:underline">
                Tout voir
              </Link>
            </div>
            {missionsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : activeMissions.length === 0 ? (
              <EmptyState title="Rien à réclamer" description="Revenez plus tard pour de nouvelles missions." />
            ) : (
              <ul className="space-y-3">
                {activeMissions.map((m) => (
                  <li key={m.mission.id}>
                    <ProgressBar value={m.progress} max={m.mission.goalCount} label={m.mission.title} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-white">Notifications récentes</p>
              <Link href="/notifications" className="text-xs font-semibold text-rc-accent hover:underline">
                Tout voir
              </Link>
            </div>
            {notifQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (notifQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState title="Aucune notification" description="Vous êtes à jour." />
            ) : (
              <ul className="space-y-2">
                {notifQuery.data!.items.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className={n.readAt ? "text-white/60" : "font-medium text-white"}>
                      {NOTIFICATION_LABELS[n.type] ?? n.type}
                    </p>
                    <p className="text-xs text-white/40">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <AppShell>
        <HomeContent />
      </AppShell>
    </RequireAuth>
  );
}
