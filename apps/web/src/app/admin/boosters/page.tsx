"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, PlusCircle, Settings2 } from "lucide-react";
import {
  createBoosterDefinitionSchema,
  publishPoolVersionSchema,
  type CreateBoosterDefinitionInput,
  type PublishPoolVersionInput,
} from "@railcards/contracts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CrAmount,
  FieldError,
  FieldGroup,
  Input,
  Label,
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
import type { BoosterDefinition } from "@/lib/types";

const BOOSTER_CATEGORIES = ["DISCOVERY", "CLASSIC", "THEMED"] as const;

function CreateBoosterForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateBoosterDefinitionInput>({ resolver: zodResolver(createBoosterDefinitionSchema), defaultValues: { imageUrl: "" } });

  const createMutation = useMutation({
    mutationFn: (values: CreateBoosterDefinitionInput) => adminApi.createBooster(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Booster créé" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "boosters"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer un booster</h2>
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
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" invalid={!!errors.category} {...register("category")}>
              <option value="">Sélectionnez</option>
              {BOOSTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <FieldError>{errors.category?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="priceCr">Prix (CR)</Label>
            <Input id="priceCr" type="number" min={1} invalid={!!errors.priceCr} {...register("priceCr")} />
            <FieldError>{errors.priceCr?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cardCount">Nombre de cartes</Label>
            <Input id="cardCount" type="number" min={1} max={15} invalid={!!errors.cardCount} {...register("cardCount")} />
            <FieldError>{errors.cardCount?.message}</FieldError>
          </FieldGroup>
          <ImageUrlField id="imageUrl" label="URL image" value={watch("imageUrl") ?? ""} onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })} error={errors.imageUrl?.message} />
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" invalid={!!errors.description} {...register("description")} />
            <FieldError>{errors.description?.message}</FieldError>
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer le booster
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function PublishPoolForm({ boosterId, onDone }: { boosterId: string; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PublishPoolVersionInput>({
    resolver: zodResolver(publishPoolVersionSchema),
    defaultValues: { entries: [{ rarityId: "", weight: 100 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "entries" });

  const publishMutation = useMutation({
    mutationFn: (values: PublishPoolVersionInput) =>
      adminApi.publishPool(boosterId, {
        entries: values.entries.map((e) => ({
          rarityId: e.rarityId,
          weight: e.weight,
          seriesId: e.seriesId || undefined,
          cardDefinitionId: e.cardDefinitionId || undefined,
        })),
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Nouvelle version du pool publiée" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "boosters"] });
      onDone();
    },
    onError: (err) => toast.show({ tone: "error", title: "Publication impossible", description: getErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((v) => publishMutation.mutate(v))} noValidate className="mt-3 space-y-2 rounded-lg border border-white/10 p-3">
      <p className="text-xs font-semibold uppercase text-white/40">Nouvelle version du pool (poids par rareté)</p>
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-wrap items-center gap-2">
          <Select {...register(`entries.${index}.rarityId` as const)} className="w-auto">
            <option value="">Rareté</option>
            {raritiesQuery.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={1}
            placeholder="Poids"
            className="w-24"
            {...register(`entries.${index}.weight` as const)}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 1}>
            Retirer
          </Button>
        </div>
      ))}
      <FieldError>{errors.entries?.message as string | undefined}</FieldError>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => append({ rarityId: "", weight: 100 })}>
          + Ajouter une entrée
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting || publishMutation.isPending}>
          Publier cette version
        </Button>
      </div>
    </form>
  );
}

function BoostersList() {
  const [editingPoolFor, setEditingPoolFor] = useState<string | null>(null);
  const boostersQuery = useQuery({
    queryKey: ["admin", "boosters"],
    queryFn: () => adminApi.listBoosters() as Promise<(BoosterDefinition & { pools?: { entries: { id: string; weight: number; rarity: { label: string } }[] }[] })[]>,
  });

  if (boostersQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      {boostersQuery.data?.map((b) => (
        <Card key={b.id}>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rc-accent/12 text-rc-accent" aria-hidden="true">
                  <Gift className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div>
                  <p className="font-display font-semibold text-white">{b.name}</p>
                  <p className="text-xs text-white/50">{b.slug} · {b.cardCount} cartes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="accent">
                  <CrAmount value={b.priceCr} />
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Settings2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => setEditingPoolFor(editingPoolFor === b.id ? null : b.id)}
                >
                  {editingPoolFor === b.id ? "Fermer" : "Gérer le pool"}
                </Button>
              </div>
            </div>
            {b.pools?.[0] && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.pools[0].entries.map((e) => (
                  <Badge key={e.id}>
                    {e.rarity.label}: {e.weight}
                  </Badge>
                ))}
              </div>
            )}
            {editingPoolFor === b.id && <PublishPoolForm boosterId={b.id} onDone={() => setEditingPoolFor(null)} />}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export default function AdminBoostersPage() {
  return (
    <AdminShell>
      <PageHeader title="Boosters" description="Définitions de boosters et pools de tirage." />
      <div className="space-y-4">
        <CreateBoosterForm />
        <BoostersList />
      </div>
    </AdminShell>
  );
}
