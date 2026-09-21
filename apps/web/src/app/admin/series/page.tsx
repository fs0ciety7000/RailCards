"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeriesSchema, type CreateSeriesInput } from "@railcards/contracts";
import { Badge, Button, Card, CardBody, FieldError, FieldGroup, Input, Label, Select, Skeleton, Textarea, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";

const CATEGORIES = Object.keys(CARD_CATEGORY_LABELS);

function CreateSeriesForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSeriesInput>({ resolver: zodResolver(createSeriesSchema) });

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
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea id="description" {...register("description")} />
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>
              Créer la série
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SeriesList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const seriesQuery = useQuery({ queryKey: ["admin", "series"], queryFn: adminApi.listSeries });

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
            <tr className="border-b border-white/10 text-xs uppercase text-white/40">
              <th className="py-2">Nom</th>
              <th>Catégorie</th>
              <th>Cartes</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seriesQuery.data?.map((s) => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="py-2 font-medium text-white">{s.name}</td>
                <td className="text-white/60">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</td>
                <td className="text-white/60">{s._count?.cards ?? 0}</td>
                <td>
                  <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
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
