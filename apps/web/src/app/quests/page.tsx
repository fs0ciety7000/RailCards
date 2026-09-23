"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Lock, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardBody, CrAmount, EmptyState, ErrorState, ProgressBar, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { questsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { QuestStepEntry } from "@/lib/types";

type StepState = "claimed" | "ready" | "current" | "locked";

function stepState(step: QuestStepEntry, isCurrent: boolean): StepState {
  if (step.claimedAt) return "claimed";
  if (step.completedAt) return "ready";
  if (isCurrent) return "current";
  return "locked";
}

function QuestStepCard({ step, state }: { step: QuestStepEntry; state: StepState }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: () => questsApi.claimStep(step.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Récompense réclamée", description: `+${step.rewardCr} CR, +${step.rewardXp} XP` });
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de réclamer", description: getErrorMessage(err) }),
  });

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold " +
            (state === "claimed"
              ? "border-rc-success bg-rc-success/15 text-rc-success"
              : state === "ready"
                ? "border-rc-accent bg-rc-accent/15 text-rc-accent"
                : state === "current"
                  ? "border-rc-accent text-rc-accent"
                  : "border-white/15 text-white/30")
          }
        >
          {state === "claimed" ? <Check className="h-4 w-4" aria-hidden="true" /> : state === "locked" ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : step.order}
        </span>
        <span className="mt-1 w-px flex-1 bg-white/10" aria-hidden="true" />
      </div>

      <Card className={"mb-4 flex-1 " + (state === "locked" ? "opacity-50" : "")}>
        <CardBody>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="font-display font-semibold text-white">{state === "locked" ? "Étape verrouillée" : step.title}</p>
            {state === "claimed" && <Badge tone="success">Réclamée</Badge>}
            {state === "ready" && <Badge tone="accent">Terminée</Badge>}
          </div>
          {state !== "locked" && <p className="mb-3 text-sm text-white/60">{step.narrative}</p>}

          {(state === "current" || state === "ready" || state === "claimed") && (
            <ProgressBar value={step.progress} max={step.goalCount} />
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2 text-xs text-white/50">
              {step.rewardCr > 0 && (
                <Badge tone="accent">
                  <CrAmount value={step.rewardCr} />
                </Badge>
              )}
              {step.rewardXp > 0 && <Badge>+{step.rewardXp} XP</Badge>}
            </div>
            {state === "ready" && (
              <Button size="sm" loading={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
                Réclamer
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function QuestsContent() {
  const questQuery = useQuery({ queryKey: ["quests", "active"], queryFn: questsApi.active });

  if (questQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (questQuery.isError) {
    return <ErrorState description={getErrorMessage(questQuery.error)} action={<Button onClick={() => questQuery.refetch()}>Réessayer</Button>} />;
  }

  const quest = questQuery.data;

  if (!quest) {
    return <EmptyState icon={<BookOpen />} title="Aucune quête en cours" description="Revenez plus tard pour la prochaine aventure saisonnière." />;
  }

  const currentStep = quest.steps.find((s) => !s.completedAt);

  return (
    <div>
      <Card className="mb-6 border-rc-accent/25 bg-rc-accent/5">
        <CardBody className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-rc-accent" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-bold text-white">{quest.title}</h2>
            <p className="mt-1 text-sm text-white/70">{quest.description}</p>
          </div>
        </CardBody>
      </Card>

      <Stagger>
        {quest.steps.map((step) => (
          <StaggerItem key={step.id}>
            <QuestStepCard step={step} state={stepState(step, step.id === currentStep?.id)} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader title="Quête saisonnière" description="Suivez l'histoire au fil de vos actions sur le réseau." />
        <QuestsContent />
      </AppShell>
    </RequireAuth>
  );
}
