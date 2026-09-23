"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Gift, Folder, ArrowLeftRight, Bell, Flame, ChevronRight } from "lucide-react";
import { Button, Card, CardBody, CrAmount, EmptyState, ProgressBar, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { usersApi, walletApi, missionsApi, notificationsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { notificationMessage, formatDateTime } from "@/lib/format";

const QUICK_LINKS = [
  { href: "/boosters", icon: Gift, title: "Ouvrir un booster", desc: "Tentez votre chance" },
  { href: "/collection", icon: Folder, title: "Ma collection", desc: "Voir mes cartes" },
  { href: "/market", icon: ArrowLeftRight, title: "Le marché", desc: "Acheter / vendre" },
] as const;

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
        description: `+${res.rewardCr} CR, +${res.rewardXp} XP · série de ${res.streak} jour(s) (×${res.multiplier.toFixed(1)})`,
      });
      if (res.leveledUp) {
        toast.show({ tone: "info", title: "Niveau supérieur !", description: `Vous êtes maintenant ${res.newGrade} (niveau ${res.newLevel}).` });
      }
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["seasons"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  const activeMissions = (missionsQuery.data ?? []).filter((m) => !m.claimedAt).slice(0, 3);

  return (
    <div className="relative">
      <div className="bg-aurora" />
      <div className="relative z-10">
      <PageHeader
        title={`Bonjour, ${meQuery.data?.displayName ?? "voyageur"}`}
        description="Voici un aperçu de votre réseau RailCards."
      />

      <Stagger className="grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <Card className="h-full">
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Portefeuille</p>
              {meQuery.isLoading ? (
                <Skeleton className="mt-2 h-8 w-32" />
              ) : (
                <p className="mt-1.5 text-3xl font-bold tracking-tight text-rc-accent">
                  <CrAmount value={meQuery.data?.walletBalance ?? 0} />
                </p>
              )}
              {meQuery.data && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-white/70">
                    {meQuery.data.grade} · Niveau {meQuery.data.level}
                  </p>
                  <ProgressBar
                    value={meQuery.data.xpProgress.xpIntoLevel}
                    max={meQuery.data.xpProgress.xpForNextLevel}
                    label="XP vers le niveau suivant"
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Récompense quotidienne</p>
              {dailyRewardQuery.isLoading ? (
                <Skeleton className="mt-2 h-8 w-32" />
              ) : dailyRewardQuery.data?.claimedToday ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm text-white/70">
                  <Flame className="h-4 w-4 text-rc-accent" aria-hidden="true" />
                  Déjà réclamée aujourd&apos;hui · série de {dailyRewardQuery.data.currentStreak} jour(s)
                </p>
              ) : (
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-white/70">Série actuelle : {dailyRewardQuery.data?.currentStreak ?? 0} jour(s)</p>
                    {(dailyRewardQuery.data?.nextMultiplier ?? 1) > 1 && (
                      <p className="mt-0.5 text-xs font-semibold text-rc-accent">
                        Multiplicateur ×{dailyRewardQuery.data!.nextMultiplier.toFixed(1)} aujourd&apos;hui
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => claimDailyReward.mutate()} loading={claimDailyReward.isPending}>
                    Réclamer
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </StaggerItem>
      </Stagger>

      <Stagger className="mt-4 grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <StaggerItem key={link.href}>
            <Link href={link.href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent">
              <Card interactive className="h-full">
                <CardBody className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-accent/12 text-rc-accent" aria-hidden="true">
                    <link.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tracking-tight text-white">{link.title}</p>
                    <p className="text-xs text-white/50">{link.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden="true" />
                </CardBody>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <Card className="h-full">
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold tracking-tight text-white">Missions en cours</p>
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
                <ul className="space-y-4">
                  {activeMissions.map((m) => (
                    <li key={m.mission.id}>
                      <ProgressBar value={m.progress} max={m.mission.goalCount} label={m.mission.title} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold tracking-tight text-white">Notifications récentes</p>
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
                <EmptyState icon={<Bell />} title="Aucune notification" description="Vous êtes à jour." />
              ) : (
                <ul className="space-y-3">
                  {notifQuery.data!.items.map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className={n.readAt ? "text-white/60" : "font-medium text-white"}>
                        {notificationMessage(n.type, n.payload)}
                      </p>
                      <p className="mt-0.5 text-xs text-white/40">{formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </StaggerItem>
      </Stagger>
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
