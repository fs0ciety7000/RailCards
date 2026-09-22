"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, PlusCircle, Power } from "lucide-react";
import { createSeriesSchema, updateSeriesSchema, type CreateSeriesInput, type UpdateSeriesInput } from "@railcards/contracts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
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
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";
import type { CardSeries } from "@/lib/types";

const CATEGORIES = Object.keys(CARD_CATEGORY_LABELS);

function CreateSeriesForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateSeriesInput>({ resolver: zodResolver(createSeriesSchema), defaultValues: { coverImageUrl: "" } });

  const createMutation = useMutation({
    mutationFn: (values: CreateSeriesInput) => adminApi.createSeries(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Série créée" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "series"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Créer une série</h2>
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
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CARD_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <FieldError>{errors.category?.message}</FieldError>
          </FieldGroup>
          <div className="sm:col-span-2">
            <ImageUrlField
              id="coverImageUrl"
              label="Image de couverture (optionnel)"
              value={watch("coverImageUrl") ?? ""}
              onChange={(url) => setValue("coverImageUrl", url, { shouldValidate: true })}
              error={errors.coverImageUrl?.message}
            />
          </div>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea id="description" {...register("description")} />
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
              Créer la série
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EditSeriesDialog({ series, onClose }: { series: CardSeries | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateSeriesInput>({ resolver: zodResolver(updateSeriesSchema) });

  useEffect(() => {
    if (!series) return;
    reset({
      name: series.name,
      description: series.description ?? "",
      coverImageUrl: series.coverImageUrl ?? "",
      isActive: series.isActive,
    });
    // Re-run only when a different series is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateSeriesInput) => adminApi.updateSeries(series!.id, values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Série mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "series"] });
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
      open={!!series}
      onClose={close}
      title="Modifier la série"
      description={series ? series.slug : undefined}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={updateMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="edit-series-form" loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      {series && (
        <form id="edit-series-form" onSubmit={handleSubmit((v) => updateMutation.mutate(v))} noValidate className="grid gap-3">
          <FieldGroup>
            <Label htmlFor="edit-series-name">Nom</Label>
            <Input id="edit-series-name" invalid={!!errors.name} {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="edit-series-description">Description (optionnel)</Label>
            <Textarea id="edit-series-description" {...register("description")} />
          </FieldGroup>
          <ImageUrlField
            id="edit-series-coverImageUrl"
            label="Image de couverture (optionnel)"
            value={watch("coverImageUrl") ?? ""}
            onChange={(url) => setValue("coverImageUrl", url, { shouldValidate: true })}
            error={errors.coverImageUrl?.message}
          />
        </form>
      )}
    </Dialog>
  );
}

function SeriesList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const seriesQuery = useQuery({ queryKey: ["admin", "series"], queryFn: adminApi.listSeries });
  const [editTarget, setEditTarget] = useState<CardSeries | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.updateSeries(id, { isActive }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Série mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "series"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (seriesQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Toutes les séries</h2>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="py-2.5">Image</th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Cartes</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seriesQuery.data?.map((s) => (
              <tr key={s.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                <td className="py-2.5">
                  {s.coverImageUrl ? (
                    <img src={s.coverImageUrl} alt="" className="h-10 w-10 rounded-md border border-rc-border object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-rc-border text-[10px] text-white/30">—</span>
                  )}
                </td>
                <td className="py-2.5 font-display font-medium text-white">{s.name}</td>
                <td className="text-white/60">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</td>
                <td className="text-white/60">{s._count?.cards ?? 0}</td>
                <td>
                  <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditTarget(s)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power className="h-3.5 w-3.5" aria-hidden="true" />}
                    loading={toggleActiveMutation.isPending}
                    onClick={() => toggleActiveMutation.mutate({ id: s.id, isActive: !s.isActive })}
                  >
                    {s.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <EditSeriesDialog series={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

export default function AdminSeriesPage() {
  return (
    <AdminShell>
      <PageHeader title="Séries" description="Gérez les séries de collection." />
      <div className="space-y-4">
        <CreateSeriesForm />
        <SeriesList />
      </div>
    </AdminShell>
  );
}
