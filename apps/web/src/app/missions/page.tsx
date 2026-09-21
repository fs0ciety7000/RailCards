"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CardBody, CrAmount, EmptyState, ErrorState, ProgressBar, Skeleton, Tabs, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { missionsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { AchievementProgress, MissionProgress } from "@/lib/types";

function MissionRow({ progress }: { progress: MissionProgress }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const claimMutation = useMutation({
    mutationFn: () => missionsApi.claim(progress.userMissionId!),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Récompense réclamée", description: `+${progress.mission.rewardCr} CR, +${progress.mission.rewardXp} XP` });
      void queryClient.invalidateQueries({ queryKey: ["missions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  const claimable = !!progress.completedAt && !progress.claimedAt;

  return (
    <Card>
      <CardBody>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="font-semibold text-white">{progress.mission.title}</p>
          {progress.claimedAt && <Badge tone="success">Réclamée</Badge>}
        </div>
        <p className="mb-3 text-sm text-white/60">{progress.mission.description}</p>
        <ProgressBar value={progress.progress} max={progress.mission.goalCount} />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2 text-xs text-white/50">
            {progress.mission.rewardCr > 0 && (
              <Badge tone="accent">
                <CrAmount value={progress.mission.rewardCr} />
              </Badge>
            )}
            {progress.mission.rewardXp > 0 && <Badge>+{progress.mission.rewardXp} XP</Badge>}
          </div>
          {!progress.claimedAt && (
            <Button size="sm" disabled={!claimable} loading={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
              Réclamer
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function AchievementRow({ progress }: { progress: AchievementProgress }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const claimMutation = useMutation({
    mutationFn: () => missionsApi.claimAchievement(progress.achievement.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Haut fait réclamé", description: `+${progress.achievement.rewardCr} CR, +${progress.achievement.rewardXp} XP` });
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  const claimable = !!progress.completedAt && !progress.claimedAt;

  return (
    <Card>
      <CardBody>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="font-semibold text-white">🏆 {progress.achievement.title}</p>
          {progress.claimedAt && <Badge tone="success">Réclamé</Badge>}
        </div>
        <p className="mb-3 text-sm text-white/60">{progress.achievement.description}</p>
        <ProgressBar value={progress.progress} max={progress.achievement.goalCount} />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2 text-xs text-white/50">
            {progress.achievement.rewardCr > 0 && (
              <Badge tone="accent">
                <CrAmount value={progress.achievement.rewardCr} />
              </Badge>
            )}
            {progress.achievement.rewardXp > 0 && <Badge>+{progress.achievement.rewardXp} XP</Badge>}
          </div>
          {!progress.claimedAt && (
            <Button size="sm" disabled={!claimable} loading={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
              Réclamer
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function MissionsContent() {
  const [tab, setTab] = useState<"missions" | "achievements">("missions");
  const missionsQuery = useQuery({ queryKey: ["missions"], queryFn: missionsApi.list });
  const achievementsQuery = useQuery({ queryKey: ["achievements"], queryFn: missionsApi.achievements });

  return (
    <div>
      <PageHeader title="Missions & hauts faits" description="Progressez et récupérez vos récompenses." />
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "missions", label: "Missions" },
            { id: "achievements", label: "Hauts faits" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as "missions" | "achievements")}
        />
      </div>

      {tab === "missions" ? (
        missionsQuery.isLoading ? (
          <SkeletonList />
        ) : missionsQuery.isError ? (
          <ErrorState description={getErrorMessage(missionsQuery.error)} />
        ) : missionsQuery.data!.length === 0 ? (
          <EmptyState title="Aucune mission active" />
        ) : (
          <div className="space-y-3">
            {missionsQuery.data!.map((m) => (
              <MissionRow key={m.mission.id} progress={m} />
            ))}
          </div>
        )
      ) : achievementsQuery.isLoading ? (
        <SkeletonList />
      ) : achievementsQuery.isError ? (
        <ErrorState description={getErrorMessage(achievementsQuery.error)} />
      ) : achievementsQuery.data!.length === 0 ? (
        <EmptyState title="Aucun haut fait disponible" />
      ) : (
        <div className="space-y-3">
          {achievementsQuery.data!.map((a) => (
            <AchievementRow key={a.achievement.id} progress={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}

export default function MissionsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <MissionsContent />
      </AppShell>
    </RequireAuth>
  );
}
