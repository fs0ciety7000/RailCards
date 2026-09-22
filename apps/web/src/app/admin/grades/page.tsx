"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import {
  createGradeSchema,
  updateGradeSchema,
  type CreateGradeInput,
  type UpdateGradeInput,
} from "@railcards/contracts";
import { Button, Card, CardBody, ConfirmDialog, Dialog, FieldError, FieldGroup, Input, Label, Skeleton, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { Grade } from "@/lib/types";

function CreateGradeForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeInput>({ resolver: zodResolver(createGradeSchema) });

  const createMutation = useMutation({
    mutationFn: (values: CreateGradeInput) => adminApi.createGrade(values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Rang créé" });
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin", "grades"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Ajouter un rang</h2>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
          <FieldGroup className="mb-0">
            <Label htmlFor="g-minLevel">Niveau minimum</Label>
            <Input id="g-minLevel" type="number" min={1} invalid={!!errors.minLevel} {...register("minLevel")} />
            <FieldError>{errors.minLevel?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="g-title">Titre</Label>
            <Input id="g-title" invalid={!!errors.title} {...register("title")} placeholder="Chef de gare" />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
          <Button type="submit" icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />} loading={isSubmitting || createMutation.isPending}>
            Ajouter
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function EditGradeDialog({ grade, onClose }: { grade: Grade | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateGradeInput>({ resolver: zodResolver(updateGradeSchema) });

  useEffect(() => {
    if (!grade) return;
    reset({ minLevel: grade.minLevel, title: grade.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade?.id]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateGradeInput) => adminApi.updateGrade(grade!.id, values),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Rang mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "grades"] });
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
      open={!!grade}
      onClose={close}
      title="Modifier le rang"
      className="max-w-sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={updateMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="edit-grade-form" loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      {grade && (
        <form id="edit-grade-form" onSubmit={handleSubmit((v) => updateMutation.mutate(v))} noValidate className="grid gap-3">
          <FieldGroup>
            <Label htmlFor="eg-minLevel">Niveau minimum</Label>
            <Input id="eg-minLevel" type="number" min={1} invalid={!!errors.minLevel} {...register("minLevel")} />
            <FieldError>{errors.minLevel?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="eg-title">Titre</Label>
            <Input id="eg-title" invalid={!!errors.title} {...register("title")} />
            <FieldError>{errors.title?.message}</FieldError>
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function GradesList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<Grade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Grade | null>(null);
  const gradesQuery = useQuery({ queryKey: ["admin", "grades"], queryFn: adminApi.listGrades });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteGrade(id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Rang supprimé" });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "grades"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Suppression impossible", description: getErrorMessage(err) }),
  });

  if (gradesQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  const sorted = [...(gradesQuery.data ?? [])].sort((a, b) => a.minLevel - b.minLevel);

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Échelle des rangs ({sorted.length})</h2>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="py-2.5">Niveau min.</th>
              <th>Titre</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={g.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                <td className="py-2.5 font-display font-semibold text-rc-accent">Niv. {g.minLevel}</td>
                <td className="text-white">{g.title}</td>
                <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditTarget(g)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => setDeleteTarget(g)}
                    className="hover:bg-rc-danger/10"
                    style={{ color: "var(--color-rc-danger)" }}
                  >
                    Supprimer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Supprimer ce rang ?"
        description="Les joueurs qui l'avaient atteint prendront automatiquement le rang immédiatement inférieur."
        destructive
        confirmLabel="Supprimer"
      />
      <EditGradeDialog grade={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

export default function AdminGradesPage() {
  return (
    <AdminShell>
      <PageHeader title="Rangs de profil" description="L'échelle de rangs que les joueurs gravissent en montant de niveau." />
      <div className="space-y-4">
        <CreateGradeForm />
        <GradesList />
      </div>
    </AdminShell>
  );
}
