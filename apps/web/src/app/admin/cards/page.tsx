"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, PlusCircle } from "lucide-react";
import { createCardSchema, type CreateCardInput } from "@railcards/contracts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
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
import { adminApi, catalogApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";

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
    formState: { errors, isSubmitting },
  } = useForm<CreateCardInput>({ resolver: zodResolver(createCardSchema) });

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
          <FieldGroup>
            <Label htmlFor="imageUrl">URL image</Label>
            <Input id="imageUrl" placeholder="/card-placeholders/rare.svg" invalid={!!errors.imageUrl} {...register("imageUrl")} />
            <FieldError>{errors.imageUrl?.message}</FieldError>
          </FieldGroup>
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

function CardsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
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
