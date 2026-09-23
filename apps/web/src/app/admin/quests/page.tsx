"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Power, Plus } from "lucide-react";
import { createQuestSchema, type CreateQuestInput } from "@railcards/contracts";
import { Badge, Button, Card, CardBody, FieldError, FieldGroup, Input, Label, Select, Skeleton, Textarea, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { MISSION_GOAL_TYPE_LABELS } from "@/lib/format";

const GOAL_TYPES = Object.keys(MISSION_GOAL_TYPE_LABELS);

function CreateQuestForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuestInput>({
    resolver: zodResolver(createQuestSchema),
    defaultValues: {
      steps: [{ order: 1, title: "", narrative: "", goalType: "OPEN_BOOSTER", goalCount: 1, rewardCr: 0, rewardXp: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "steps" });

  const createMutation = useMutation({
    mutationFn: (values: CreateQuestInput) => adminApi.createQuest(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Quête publiée", description: "Elle remplace la quête active précédente." });
      reset({ steps: [{ order: 1, title: "", narrative: "", goalType: "OPEN_BOOSTER", goalCount: 1, rewardCr: 0, rewardXp: 0 }] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "quests"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Publication impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 font-semibold text-white">Écrire une nouvelle quête saisonnière</h2>
        <p className="mb-3 text-xs text-white/50">
          La publier remplace automatiquement la quête active actuelle (archivée, pas supprimée). Les joueurs progressent d&apos;étape en étape, dans l&apos;ordre.
        </p>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="q-slug">Slug</Label>
              <Input id="q-slug" invalid={!!errors.slug} {...register("slug")} placeholder="saison-1-grand-voyage" />
              <FieldError>{errors.slug?.message}</FieldError>
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="q-title">Titre</Label>
              <Input id="q-title" invalid={!!errors.title} {...register("title")} />
              <FieldError>{errors.title?.message}</FieldError>
            </FieldGroup>
            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="q-description">Description</Label>
              <Textarea id="q-description" invalid={!!errors.description} {...register("description")} />
              <FieldError>{errors.description?.message}</FieldError>
            </FieldGroup>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Étapes (dans l&apos;ordre)</p>
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-lg border border-white/10 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-order-${index}`}>Ordre</Label>
                    <Input id={`s-order-${index}`} type="number" min={1} {...register(`steps.${index}.order` as const)} />
                  </FieldGroup>
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-title-${index}`}>Titre de l&apos;étape</Label>
                    <Input id={`s-title-${index}`} invalid={!!errors.steps?.[index]?.title} {...register(`steps.${index}.title` as const)} />
                  </FieldGroup>
                </div>
                <FieldGroup className="mb-0">
                  <Label htmlFor={`s-narrative-${index}`}>Texte narratif</Label>
                  <Textarea id={`s-narrative-${index}`} rows={2} invalid={!!errors.steps?.[index]?.narrative} {...register(`steps.${index}.narrative` as const)} />
                </FieldGroup>
                <div className="grid gap-2 sm:grid-cols-4">
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-goalType-${index}`}>Objectif</Label>
                    <Select id={`s-goalType-${index}`} {...register(`steps.${index}.goalType` as const)}>
                      {GOAL_TYPES.map((g) => (
                        <option key={g} value={g}>
                          {MISSION_GOAL_TYPE_LABELS[g]}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-goalCount-${index}`}>Quantité</Label>
                    <Input id={`s-goalCount-${index}`} type="number" min={1} {...register(`steps.${index}.goalCount` as const)} />
                  </FieldGroup>
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-rewardCr-${index}`}>Récompense CR</Label>
                    <Input id={`s-rewardCr-${index}`} type="number" min={0} {...register(`steps.${index}.rewardCr` as const)} />
                  </FieldGroup>
                  <FieldGroup className="mb-0">
                    <Label htmlFor={`s-rewardXp-${index}`}>Récompense XP</Label>
                    <Input id={`s-rewardXp-${index}`} type="number" min={0} {...register(`steps.${index}.rewardXp` as const)} />
                  </FieldGroup>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 1}>
                  Retirer cette étape
                </Button>
              </div>
            ))}
            <FieldError>{errors.steps?.message as string | undefined}</FieldError>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                append({ order: fields.length + 1, title: "", narrative: "", goalType: "OPEN_BOOSTER", goalCount: 1, rewardCr: 0, rewardXp: 0 })
              }
            >
              + Ajouter une étape
            </Button>
          </div>

          <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
            Publier la quête
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function QuestsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const questsQuery = useQuery({ queryKey: ["admin", "quests"], queryFn: adminApi.listQuests });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => adminApi.archiveQuest(id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Quête archivée" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "quests"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (questsQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Toutes les quêtes</h2>
        <div className="space-y-3">
          {questsQuery.data?.map((q) => (
            <div key={q.id} className="rounded-lg border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-semibold text-white">{q.title}</p>
                  <p className="text-xs text-white/50">
                    {q.slug} · {q.steps.length} étape(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={q.status === "ACTIVE" ? "success" : "neutral"}>{q.status === "ACTIVE" ? "Active" : "Archivée"}</Badge>
                  {q.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Power className="h-3.5 w-3.5" aria-hidden="true" />}
                      loading={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate(q.id)}
                    >
                      Archiver
                    </Button>
                  )}
                </div>
              </div>
              <ol className="mt-2 space-y-1 text-xs text-white/50">
                {q.steps.map((s) => (
                  <li key={s.id}>
                    {s.order}. {s.title} — {MISSION_GOAL_TYPE_LABELS[s.goalType] ?? s.goalType} × {s.goalCount} ({s.rewardCr} CR / {s.rewardXp} XP)
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {questsQuery.data?.length === 0 && <p className="text-sm text-white/50">Aucune quête créée pour l&apos;instant.</p>}
        </div>
      </CardBody>
    </Card>
  );
}

export default function AdminQuestsPage() {
  return (
    <AdminShell>
      <PageHeader title="Quêtes saisonnières" description="Rédigez la questline narrative en cours et suivez son historique." />
      <div className="space-y-4">
        <CreateQuestForm />
        <QuestsList />
      </div>
    </AdminShell>
  );
}
