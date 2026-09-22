"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, PlusCircle, Pencil } from "lucide-react";
import { createCardSchema, updateCardSchema, type CreateCardInput, type UpdateCardInput } from "@railcards/contracts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  Dialog,
  FieldError,
  FieldGroup,
  Input,
  Label,
  RarityBadge,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { ImageUrlField } from "@/components/ImageUrlField";
import { adminApi, catalogApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";
import type { CardDefinition } from "@/lib/types";

function asCombatStats(value: unknown): { power: number; reliability: number; charm: number } {
  if (value && typeof value === "object" && "power" in value) {
    const v = value as { power?: unknown; reliability?: unknown; charm?: unknown };
    return {
      power: typeof v.power === "number" ? v.power : 0,
      reliability: typeof v.reliability === "number" ? v.reliability : 0,
      charm: typeof v.charm === "number" ? v.charm : 0,
    };
  }
  return { power: 0, reliability: 0, charm: 0 };
}

const CATEGORIES = Object.keys(CARD_CATEGORY_LABELS);

function CreateCardForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const seriesQuery = useQuery({ queryKey: ["admin", "series"], queryFn: adminApi.listSeries });
  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCardInput>({ resolver: zodResolver(createCardSchema), defaultValues: { imageUrl: "" } });

  const createMutation = useMutation({
    mutationFn: (values: CreateCardInput) => adminApi.createCard(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Carte créée (brouillon)" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "cards"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer une carte</h2>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" invalid={!!errors.slug} {...register("slug")} />
            <FieldError>{errors.slug?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" invalid={!!errors.name} {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="seriesId">Série</Label>
            <Select id="seriesId" invalid={!!errors.seriesId} {...register("seriesId")}>
              <option value="">Sélectionnez</option>
              {seriesQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <FieldError>{errors.seriesId?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="rarityId">Rareté</Label>
            <Select id="rarityId" invalid={!!errors.rarityId} {...register("rarityId")}>
              <option value="">Sélectionnez</option>
              {raritiesQuery.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            <FieldError>{errors.rarityId?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" invalid={!!errors.category} {...register("category")}>
              <option value="">Sélectionnez</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CARD_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <FieldError>{errors.category?.message}</FieldError>
          </FieldGroup>
          <ImageUrlField id="imageUrl" label="URL image" value={watch("imageUrl") ?? ""} onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })} error={errors.imageUrl?.message} />
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="flavorText">Texte d&apos;ambiance (optionnel)</Label>
            <Input id="flavorText" {...register("flavorText")} />
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />}
              loading={isSubmitting || createMutation.isPending}
            >
              Créer la carte
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EditCardDialog({ card, onClose }: { card: CardDefinition | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateCardInput>({ resolver: zodResolver(updateCardSchema) });

  const combatStatsEnabled = watch("combatStatsEnabled");

  useEffect(() => {
    if (!card) return;
    reset({
      name: card.name,
      description: card.description,
      flavorText: card.flavorText ?? "",
      rarityId: card.rarityId,
      imageUrl: card.imageUrl,
      combatStatsEnabled: card.combatStatsEnabled,
      combatStats: asCombatStats(card.combatStats),
    });
    // Re-run only when a different card is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateCardInput) => adminApi.updateCard(card!.id, values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Carte mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "cards"] });
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
      open={!!card}
      onClose={close}
      title="Modifier la carte"
      description={card ? `${card.name} — ${card.series.name}` : undefined}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={updateMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="edit-card-form" loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      {card && (
        <form
          id="edit-card-form"
          onSubmit={handleSubmit((v) => updateMutation.mutate(v))}
          noValidate
          className="grid gap-3 sm:grid-cols-2"
        >
          <FieldGroup>
            <Label htmlFor="edit-name">Nom</Label>
            <Input id="edit-name" invalid={!!errors.name} {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="edit-rarityId">Rareté</Label>
            <Select id="edit-rarityId" invalid={!!errors.rarityId} {...register("rarityId")}>
              {raritiesQuery.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            <FieldError>{errors.rarityId?.message}</FieldError>
          </FieldGroup>
          <div className="sm:col-span-2">
            <ImageUrlField
              id="edit-imageUrl"
              label="URL image"
              value={watch("imageUrl") ?? ""}
              onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })}
              error={errors.imageUrl?.message}
            />
          </div>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="edit-flavorText">Texte d&apos;ambiance (optionnel)</Label>
            <Input id="edit-flavorText" {...register("flavorText")} />
          </FieldGroup>
          <FieldGroup className="sm:col-span-2 mb-0">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 accent-[var(--color-rc-accent)]"
                {...register("combatStatsEnabled")}
              />
              Activer les statistiques de combat
            </label>
            {combatStatsEnabled && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <FieldGroup className="mb-0">
                  <Label htmlFor="edit-power">Puissance</Label>
                  <Input id="edit-power" type="number" min={0} max={100} {...register("combatStats.power")} />
                </FieldGroup>
                <FieldGroup className="mb-0">
                  <Label htmlFor="edit-reliability">Fiabilité</Label>
                  <Input id="edit-reliability" type="number" min={0} max={100} {...register("combatStats.reliability")} />
                </FieldGroup>
                <FieldGroup className="mb-0">
                  <Label htmlFor="edit-charm">Charme</Label>
                  <Input id="edit-charm" type="number" min={0} max={100} {...register("combatStats.charm")} />
                </FieldGroup>
              </div>
            )}
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function CardsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CardDefinition | null>(null);
  const cardsQuery = useQuery({ queryKey: ["admin", "cards"], queryFn: () => adminApi.listCards({ pageSize: 100 }) });

  const publishMutation = useMutation({
    mutationFn: (id: string) => adminApi.publishCard(id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Carte publiée" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "cards"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => adminApi.archiveCard(id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Carte archivée" });
      setArchiveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "cards"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (cardsQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Toutes les cartes ({cardsQuery.data?.total ?? 0})</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="py-2.5">Nom</th>
              <th>Série</th>
              <th>Rareté</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cardsQuery.data?.items.map((card) => (
              <tr key={card.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                <td className="py-2.5 font-medium text-white">{card.name}</td>
                <td className="text-white/60">{card.series?.name}</td>
                <td>
                  <RarityBadge label={card.rarity.label} colorHex={card.rarity.colorHex} size="sm" />
                </td>
                <td>
                  <Badge tone={card.status === "PUBLISHED" ? "success" : card.status === "DRAFT" ? "info" : "danger"}>
                    {card.status}
                  </Badge>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => setEditTarget(card)}
                    >
                      Modifier
                    </Button>
                    {card.status !== "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        loading={publishMutation.isPending}
                        onClick={() => publishMutation.mutate(card.id)}
                      >
                        Publier
                      </Button>
                    )}
                    {card.status !== "ARCHIVED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Archive className="h-3.5 w-3.5" aria-hidden="true" />}
                        onClick={() => setArchiveTarget(card.id)}
                        className="hover:bg-rc-danger/10"
                        style={{ color: "var(--color-rc-danger)" }}
                      >
                        Archiver
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
        loading={archiveMutation.isPending}
        title="Archiver cette carte ?"
        description="La carte ne sera plus proposée dans les boosters, mais les exemplaires déjà possédés restent inchangés."
        destructive
        confirmLabel="Archiver"
      />
      <EditCardDialog card={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

export default function AdminCardsPage() {
  return (
    <AdminShell>
      <PageHeader title="Cartes" description="Créez, publiez et archivez le catalogue de cartes." />
      <div className="space-y-4">
        <CreateCardForm />
        <CardsList />
      </div>
    </AdminShell>
  );
}
