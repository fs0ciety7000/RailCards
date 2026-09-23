"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Sparkles, Trophy } from "lucide-react";
import { Badge, Button, Card, CardBody, CrAmount, EmptyState, ErrorState, ProgressBar, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { seasonPassApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { SeasonPassTier } from "@/lib/types";

function TierRow({ tier, points }: { tier: SeasonPassTier; points: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: () => seasonPassApi.claim(tier.id),
    onSuccess: (res) => {
      toast.show({
        tone: "success",
        title: "Récompense réclamée",
        description: [tier.rewardCr > 0 ? `+${tier.rewardCr} CR` : null, tier.rewardXp > 0 ? `+${tier.rewardXp} XP` : null].filter(Boolean).join(", "),
      });
      if (res.leveledUp) {
        toast.show({ tone: "info", title: "Niveau supérieur !" });
      }
      void queryClient.invalidateQueries({ queryKey: ["season-pass"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  return (
    <Card className={tier.claimed ? "opacity-70" : undefined}>
      <CardBody className="flex items-center gap-4 py-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            tier.claimed ? "bg-emerald-500/20 text-emerald-300" : tier.unlocked ? "bg-rc-accent/20 text-rc-accent" : "bg-white/[0.06] text-white/40"
          }`}
        >
          {tier.claimed ? <Check className="h-5 w-5" aria-hidden="true" /> : tier.unlocked ? tier.tier : <Lock className="h-4 w-4" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            Palier {tier.tier} <span className="font-normal text-white/50">· {tier.pointsRequired} pts</span>
          </p>
          {tier.rewardLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {tier.rewardLabel}
            </p>
          )}
          <div className="mt-1.5 flex gap-2 text-xs text-white/50">
            {tier.rewardCr > 0 && (
              <Badge tone="accent">
                <CrAmount value={tier.rewardCr} />
              </Badge>
            )}
            {tier.rewardXp > 0 && <Badge>+{tier.rewardXp} XP</Badge>}
          </div>
        </div>
        {tier.claimed ? (
          <Badge tone="success">Réclamée</Badge>
        ) : (
          <Button size="sm" disabled={!tier.unlocked} loading={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
            {tier.unlocked ? "Réclamer" : `${points}/${tier.pointsRequired}`}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function SeasonPassContent() {
  const boardQuery = useQuery({ queryKey: ["season-pass"], queryFn: seasonPassApi.tiers });

  if (boardQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (boardQuery.isError) {
    return <ErrorState description={getErrorMessage(boardQuery.error)} />;
  }
  if (!boardQuery.data?.season) {
    return <EmptyState icon={<Trophy />} title="Aucune saison en cours" description="Le pass de saison sera disponible lors de la prochaine saison compétitive." />;
  }

  const { season, points, tiers } = boardQuery.data;
  const nextLockedTier = tiers.find((t) => !t.unlocked);
  const maxPoints = tiers.length > 0 ? tiers[tiers.length - 1]!.pointsRequired : 0;

  return (
    <div>
      <p className="mb-4 text-sm text-white/60">
        Saison <span className="font-semibold text-white">{season.name}</span> · depuis le {formatDate(season.startedAt)} ·{" "}
        <span className="font-semibold text-white">{points} pts</span>
      </p>
      {tiers.length > 0 && (
        <div className="mb-5">
          <ProgressBar value={points} max={Math.max(maxPoints, 1)} />
        </div>
      )}

      {tiers.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Aucun palier pour cette saison" description="Revenez plus tard, les récompenses du pass n'ont pas encore été publiées." />
      ) : (
        <Stagger className="space-y-2">
          {tiers.map((t) => (
            <StaggerItem key={t.id}>
              <TierRow tier={t} points={points} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {nextLockedTier && (
        <p className="mt-4 text-center text-xs text-white/40">
          Encore {nextLockedTier.pointsRequired - points} pts pour le palier {nextLockedTier.tier}
        </p>
      )}
    </div>
  );
}

export default function SeasonPassPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader title="Pass de saison" description="Débloquez des récompenses à mesure que vous marquez des points cette saison." />
        <SeasonPassContent />
      </AppShell>
    </RequireAuth>
  );
}
