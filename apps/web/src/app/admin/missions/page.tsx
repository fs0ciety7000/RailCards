"use client";

import { useEffect, useState } from "react";
import { useForm, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power } from "lucide-react";
import {
  createAchievementSchema,
  createMissionSchema,
  createProfileBannerSchema,
  createProfileTitleSchema,
  updateAchievementSchema,
  updateMissionSchema,
  type CreateAchievementInput,
  type CreateMissionInput,
  type CreateProfileBannerInput,
  type CreateProfileTitleInput,
  type UpdateAchievementInput,
  type UpdateMissionInput,
} from "@railcards/contracts";
import { Badge, Button, Card, CardBody, Dialog, FieldError, FieldGroup, Input, Label, Select, Skeleton, Tabs, Textarea, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { MISSION_GOAL_TYPE_LABELS } from "@/lib/format";
import type { Achievement, Mission, ProfileBanner, ProfileTitle } from "@/lib/types";

const GOAL_TYPES = Object.keys(MISSION_GOAL_TYPE_LABELS);

function GoalTypeField<T extends FieldValues>({
  id,
  error,
  register,
}: {
  id: string;
  error?: string;
  register: UseFormRegister<T>;
}) {
  return (
    <FieldGroup>
      <Label htmlFor={id}>Type d&apos;objectif</Label>
      <Select id={id} invalid={!!error} {...register("goalType" as Path<T>)}>
        {GOAL_TYPES.map((g) => (
          <option key={g} value={g}>
            {MISSION_GOAL_TYPE_LABELS[g]}
          </option>
        ))}
      </Select>
      <FieldError>{error}</FieldError>
    </FieldGroup>
  );
}

function RewardBannerField<T extends FieldValues>({ id, register }: { id: string; register: UseFormRegister<T> }) {
  const bannersQuery = useQuery({ queryKey: ["admin", "profile-banners"], queryFn: adminApi.listProfileBanners });
  return (
    <FieldGroup>
      <Label htmlFor={id}>Bannière débloquée (optionnel)</Label>
      <Select id={id} {...register("rewardBannerId" as Path<T>)}>
        <option value="">Aucune</option>
        {bannersQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </FieldGroup>
  );
}

function RewardTitleField<T extends FieldValues>({ id, register }: { id: string; register: UseFormRegister<T> }) {
  const titlesQuery = useQuery({ queryKey: ["admin", "profile-titles"], queryFn: adminApi.listProfileTitles });
  return (
    <FieldGroup>
      <Label htmlFor={id}>Titre débloqué (optionnel)</Label>
      <Select id={id} {...register("rewardTitleId" as Path<T>)}>
        <option value="">Aucun</option>
        {titlesQuery.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>
    </FieldGroup>
  );
}

function CreateMissionForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMissionInput>({ resolver: zodResolver(createMissionSchema), defaultValues: { goalType: "OPEN_BOOSTER", resetPeriod: "NONE" } });

  const createMutation = useMutation({
    mutationFn: (values: CreateMissionInput) => adminApi.createMission(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Mission créée" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer une mission</h2>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="m-code">Code</Label>
            <Input id="m-code" invalid={!!errors.code} {...register("code")} placeholder="daily-sell-3" />
            <FieldError>{errors.code?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="m-title">Titre</Label>
            <Input id="m-title" invalid={!!errors.title} {...register("title")} />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="m-description">Description</Label>
            <Textarea id="m-description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <GoalTypeField id="m-goalType" error={errors.goalType?.message} register={register} />
          <FieldGroup>
            <Label htmlFor="m-goalCount">Objectif (quantité)</Label>
            <Input id="m-goalCount" type="number" min={1} invalid={!!errors.goalCount} {...register("goalCount")} />
            <FieldError>{errors.goalCount?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="m-rewardCr">Récompense (CR)</Label>
            <Input id="m-rewardCr" type="number" min={0} {...register("rewardCr")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="m-rewardXp">Récompense (XP)</Label>
            <Input id="m-rewardXp" type="number" min={0} {...register("rewardXp")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="m-resetPeriod">Réinitialisation</Label>
            <Select id="m-resetPeriod" {...register("resetPeriod")}>
              <option value="NONE">Aucune (unique)</option>
              <option value="DAILY">Quotidienne</option>
            </Select>
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer la mission
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EditMissionDialog({ mission, onClose }: { mission: Mission | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateMissionInput>({ resolver: zodResolver(updateMissionSchema) });

  useEffect(() => {
    if (!mission) return;
    reset({
      title: mission.title,
      description: mission.description,
      goalType: mission.goalType,
      goalCount: mission.goalCount,
      rewardCr: mission.rewardCr,
      rewardXp: mission.rewardXp,
      resetPeriod: mission.resetPeriod,
      isActive: mission.isActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.id]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateMissionInput) => adminApi.updateMission(mission!.id, values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Mission mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec de la mise à jour", description: getErrorMessage(err) }),
  });

  function close() {
    reset();
    onClose();
  }

  return (
    <Dialog
      open={!!mission}
      onClose={close}
      title="Modifier la mission"
      description={mission?.code}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={updateMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="edit-mission-form" loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      {mission && (
        <form id="edit-mission-form" onSubmit={handleSubmit((v) => updateMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="em-title">Titre</Label>
            <Input id="em-title" invalid={!!errors.title} {...register("title")} />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
          <GoalTypeField id="em-goalType" error={errors.goalType?.message} register={register} />
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="em-description">Description</Label>
            <Textarea id="em-description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="em-goalCount">Objectif (quantité)</Label>
            <Input id="em-goalCount" type="number" min={1} {...register("goalCount")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="em-resetPeriod">Réinitialisation</Label>
            <Select id="em-resetPeriod" {...register("resetPeriod")}>
              <option value="NONE">Aucune (unique)</option>
              <option value="DAILY">Quotidienne</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="em-rewardCr">Récompense (CR)</Label>
            <Input id="em-rewardCr" type="number" min={0} {...register("rewardCr")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="em-rewardXp">Récompense (XP)</Label>
            <Input id="em-rewardXp" type="number" min={0} {...register("rewardXp")} />
          </FieldGroup>
          <FieldGroup className="sm:col-span-2 mb-0">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" className="h-4 w-4 rounded border-white/30 accent-[var(--color-rc-accent)]" {...register("isActive")} />
              Mission active
            </label>
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function MissionsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<Mission | null>(null);
  const missionsQuery = useQuery({ queryKey: ["admin", "missions"], queryFn: adminApi.listMissions });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.updateMission(id, { isActive }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Mission mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (missionsQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Toutes les missions</h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="py-2.5">Titre</th>
              <th>Objectif</th>
              <th>Récompenses</th>
              <th>Réinit.</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {missionsQuery.data?.map((m) => (
              <tr key={m.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                <td className="py-2.5 font-display font-medium text-white">{m.title}</td>
                <td className="text-white/60">
                  {MISSION_GOAL_TYPE_LABELS[m.goalType] ?? m.goalType} × {m.goalCount}
                </td>
                <td className="text-white/60">
                  {m.rewardCr} CR / {m.rewardXp} XP
                </td>
                <td className="text-white/60">{m.resetPeriod === "DAILY" ? "Quotidienne" : "Unique"}</td>
                <td>
                  <Badge tone={m.isActive ? "success" : "neutral"}>{m.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditTarget(m)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power className="h-3.5 w-3.5" aria-hidden="true" />}
                    loading={toggleActiveMutation.isPending}
                    onClick={() => toggleActiveMutation.mutate({ id: m.id, isActive: !m.isActive })}
                  >
                    {m.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <EditMissionDialog mission={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

function CreateAchievementForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAchievementInput>({ resolver: zodResolver(createAchievementSchema), defaultValues: { goalType: "OPEN_BOOSTER" } });

  const createMutation = useMutation({
    mutationFn: (values: CreateAchievementInput) =>
      adminApi.createAchievement({ ...values, rewardBannerId: values.rewardBannerId || undefined, rewardTitleId: values.rewardTitleId || undefined }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Haut fait créé" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "achievements"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer un haut fait</h2>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="a-code">Code</Label>
            <Input id="a-code" invalid={!!errors.code} {...register("code")} placeholder="open-50-boosters" />
            <FieldError>{errors.code?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="a-title">Titre</Label>
            <Input id="a-title" invalid={!!errors.title} {...register("title")} />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="a-description">Description</Label>
            <Textarea id="a-description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <GoalTypeField id="a-goalType" error={errors.goalType?.message} register={register} />
          <FieldGroup>
            <Label htmlFor="a-goalCount">Objectif (quantité)</Label>
            <Input id="a-goalCount" type="number" min={1} invalid={!!errors.goalCount} {...register("goalCount")} />
            <FieldError>{errors.goalCount?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="a-rewardCr">Récompense (CR)</Label>
            <Input id="a-rewardCr" type="number" min={0} {...register("rewardCr")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="a-rewardXp">Récompense (XP)</Label>
            <Input id="a-rewardXp" type="number" min={0} {...register("rewardXp")} />
          </FieldGroup>
          <RewardBannerField id="a-rewardBannerId" register={register} />
          <RewardTitleField id="a-rewardTitleId" register={register} />
          <div className="sm:col-span-2">
            <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer le haut fait
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EditAchievementDialog({ achievement, onClose }: { achievement: Achievement | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateAchievementInput>({ resolver: zodResolver(updateAchievementSchema) });

  useEffect(() => {
    if (!achievement) return;
    reset({
      title: achievement.title,
      description: achievement.description,
      goalType: achievement.goalType,
      goalCount: achievement.goalCount,
      rewardCr: achievement.rewardCr,
      rewardXp: achievement.rewardXp,
      rewardBannerId: achievement.rewardBannerId ?? "",
      rewardTitleId: achievement.rewardTitleId ?? "",
      isActive: achievement.isActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement?.id]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateAchievementInput) =>
      adminApi.updateAchievement(achievement!.id, {
        ...values,
        rewardBannerId: values.rewardBannerId || undefined,
        rewardTitleId: values.rewardTitleId || undefined,
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Haut fait mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "achievements"] });
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec de la mise à jour", description: getErrorMessage(err) }),
  });

  function close() {
    reset();
    onClose();
  }

  return (
    <Dialog
      open={!!achievement}
      onClose={close}
      title="Modifier le haut fait"
      description={achievement?.code}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={updateMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="edit-achievement-form" loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      {achievement && (
        <form id="edit-achievement-form" onSubmit={handleSubmit((v) => updateMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="ea-title">Titre</Label>
            <Input id="ea-title" invalid={!!errors.title} {...register("title")} />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
          <GoalTypeField id="ea-goalType" error={errors.goalType?.message} register={register} />
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="ea-description">Description</Label>
            <Textarea id="ea-description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ea-goalCount">Objectif (quantité)</Label>
            <Input id="ea-goalCount" type="number" min={1} {...register("goalCount")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ea-rewardCr">Récompense (CR)</Label>
            <Input id="ea-rewardCr" type="number" min={0} {...register("rewardCr")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ea-rewardXp">Récompense (XP)</Label>
            <Input id="ea-rewardXp" type="number" min={0} {...register("rewardXp")} />
          </FieldGroup>
          <RewardBannerField id="ea-rewardBannerId" register={register} />
          <RewardTitleField id="ea-rewardTitleId" register={register} />
          <FieldGroup className="sm:col-span-2 mb-0">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" className="h-4 w-4 rounded border-white/30 accent-[var(--color-rc-accent)]" {...register("isActive")} />
              Haut fait actif
            </label>
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function AchievementsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<Achievement | null>(null);
  const achievementsQuery = useQuery({ queryKey: ["admin", "achievements"], queryFn: adminApi.listAchievements });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.updateAchievement(id, { isActive }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Haut fait mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "achievements"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (achievementsQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Tous les hauts faits</h2>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="py-2.5">Titre</th>
              <th>Objectif</th>
              <th>Récompenses</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {achievementsQuery.data?.map((a) => (
              <tr key={a.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                <td className="py-2.5 font-display font-medium text-white">{a.title}</td>
                <td className="text-white/60">
                  {MISSION_GOAL_TYPE_LABELS[a.goalType] ?? a.goalType} × {a.goalCount}
                </td>
                <td className="text-white/60">
                  {a.rewardCr} CR / {a.rewardXp} XP
                </td>
                <td>
                  <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "Actif" : "Inactif"}</Badge>
                </td>
                <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditTarget(a)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power className="h-3.5 w-3.5" aria-hidden="true" />}
                    loading={toggleActiveMutation.isPending}
                    onClick={() => toggleActiveMutation.mutate({ id: a.id, isActive: !a.isActive })}
                  >
                    {a.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <EditAchievementDialog achievement={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

function CreateProfileBannerForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProfileBannerInput>({ resolver: zodResolver(createProfileBannerSchema) });

  const createMutation = useMutation({
    mutationFn: (values: CreateProfileBannerInput) => adminApi.createProfileBanner(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Bannière créée" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "profile-banners"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer une bannière</h2>
        <p className="mb-3 text-sm text-white/50">
          Débloquée en l&apos;attachant à un haut fait (champ « Bannière débloquée » dans l&apos;onglet Hauts faits).
        </p>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="b-slug">Slug</Label>
            <Input id="b-slug" invalid={!!errors.slug} {...register("slug")} placeholder="veteran-saison-1" />
            <FieldError>{errors.slug?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="b-name">Nom</Label>
            <Input id="b-name" invalid={!!errors.name} {...register("name")} placeholder="Vétéran saison 1" />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="b-colorFrom">Couleur de départ (dégradé)</Label>
            <Input id="b-colorFrom" invalid={!!errors.colorFrom} {...register("colorFrom")} placeholder="#f59e0b" />
            <FieldError>{errors.colorFrom?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="b-colorTo">Couleur de fin (dégradé)</Label>
            <Input id="b-colorTo" invalid={!!errors.colorTo} {...register("colorTo")} placeholder="#ef4444" />
            <FieldError>{errors.colorTo?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="b-icon">Icône (nom lucide-react)</Label>
            <Input id="b-icon" invalid={!!errors.icon} {...register("icon")} placeholder="flame" />
            <FieldError>{errors.icon?.message}</FieldError>
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer la bannière
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ProfileBannersList() {
  const bannersQuery = useQuery({ queryKey: ["admin", "profile-banners"], queryFn: adminApi.listProfileBanners });

  if (bannersQuery.isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Toutes les bannières</h2>
        {!bannersQuery.data?.length ? (
          <p className="text-sm text-white/50">Aucune bannière créée pour l&apos;instant.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {bannersQuery.data.map((b: ProfileBanner) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-rc-border px-3 py-2"
                style={{ background: `linear-gradient(135deg, ${b.colorFrom}22, ${b.colorTo}22)` }}
              >
                <div>
                  <p className="font-medium text-white">{b.name}</p>
                  <p className="text-xs text-white/50">{b.slug}</p>
                </div>
                <Badge>{b.icon}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function CreateProfileTitleForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProfileTitleInput>({ resolver: zodResolver(createProfileTitleSchema) });

  const createMutation = useMutation({
    mutationFn: (values: CreateProfileTitleInput) => adminApi.createProfileTitle(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Titre créé" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "profile-titles"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer un titre</h2>
        <p className="mb-3 text-sm text-white/50">
          Débloqué en l&apos;attachant à un haut fait (champ « Titre débloqué » dans l&apos;onglet Hauts faits).
        </p>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="t-slug">Slug</Label>
            <Input id="t-slug" invalid={!!errors.slug} {...register("slug")} placeholder="veteran-saison-1" />
            <FieldError>{errors.slug?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="t-label">Libellé affiché</Label>
            <Input id="t-label" invalid={!!errors.label} {...register("label")} placeholder="Vétéran de la saison" />
            <FieldError>{errors.label?.message}</FieldError>
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer le titre
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ProfileTitlesList() {
  const titlesQuery = useQuery({ queryKey: ["admin", "profile-titles"], queryFn: adminApi.listProfileTitles });

  if (titlesQuery.isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Tous les titres</h2>
        {!titlesQuery.data?.length ? (
          <p className="text-sm text-white/50">Aucun titre créé pour l&apos;instant.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {titlesQuery.data.map((t: ProfileTitle) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-rc-border px-3 py-2">
                <div>
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-xs text-white/50">{t.slug}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function AdminMissionsPage() {
  const [tab, setTab] = useState("missions");

  return (
    <AdminShell>
      <PageHeader title="Missions & hauts faits" description="Créez et gérez les missions quotidiennes et les hauts faits." />
      <div className="mb-4 max-w-xl">
        <Tabs
          tabs={[
            { id: "missions", label: "Missions" },
            { id: "achievements", label: "Hauts faits" },
            { id: "banners", label: "Bannières" },
            { id: "titles", label: "Titres" },
          ]}
          activeId={tab}
          onChange={setTab}
        />
      </div>
      {tab === "missions" ? (
        <div className="space-y-4">
          <CreateMissionForm />
          <MissionsList />
        </div>
      ) : tab === "achievements" ? (
        <div className="space-y-4">
          <CreateAchievementForm />
          <AchievementsList />
        </div>
      ) : tab === "banners" ? (
        <div className="space-y-4">
          <CreateProfileBannerForm />
          <ProfileBannersList />
        </div>
      ) : (
        <div className="space-y-4">
          <CreateProfileTitleForm />
          <ProfileTitlesList />
        </div>
      )}
    </AdminShell>
  );
}
