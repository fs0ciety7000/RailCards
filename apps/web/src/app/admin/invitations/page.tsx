"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInvitationSchema, type CreateInvitationInput } from "@railcards/contracts";
import { Badge, Button, Card, CardBody, FieldGroup, Input, Label, Skeleton, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";

function CreateInvitationForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lastCode, setLastCode] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateInvitationInput>({ resolver: zodResolver(createInvitationSchema), defaultValues: { maxUses: 1 } });

  const createMutation = useMutation({
    mutationFn: (values: CreateInvitationInput) =>
      adminApi.createInvitation({
        email: values.email || undefined,
        maxUses: values.maxUses,
        expiresInDays: values.expiresInDays,
      }),
    onSuccess: (invitation) => {
      setLastCode(invitation.code);
      toast.show({ tone: "success", title: "Invitation créée", description: invitation.code });
      reset({ maxUses: 1 });
      void queryClient.invalidateQueries({ queryKey: ["admin", "invitations"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Générer une invitation</h2>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-3">
          <FieldGroup>
            <Label htmlFor="email">Email (optionnel)</Label>
            <Input id="email" type="email" {...register("email")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="maxUses">Utilisations max</Label>
            <Input id="maxUses" type="number" min={1} {...register("maxUses")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="expiresInDays">Expire dans (jours, optionnel)</Label>
            <Input id="expiresInDays" type="number" min={1} {...register("expiresInDays")} />
          </FieldGroup>
          <div className="sm:col-span-3">
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>
              Générer le code
            </Button>
          </div>
        </form>
        {lastCode && (
          <p className="mt-3 rounded-lg bg-rc-accent/10 p-3 text-sm text-rc-accent">
            Dernier code généré : <span className="font-mono font-bold">{lastCode}</span>
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function InvitationsList() {
  const invitationsQuery = useQuery({
    queryKey: ["admin", "invitations"],
    queryFn: () => adminApi.listInvitations({ pageSize: 50 }),
  });

  if (invitationsQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <h2 className="mb-3 font-semibold text-white">Invitations ({invitationsQuery.data?.total ?? 0})</h2>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase text-white/40">
              <th className="py-2">Code</th>
              <th>Email</th>
              <th>Utilisations</th>
              <th>Expire</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {invitationsQuery.data?.items.map((inv) => (
              <tr key={inv.id} className="border-b border-white/5">
                <td className="py-2 font-mono text-white">{inv.code}</td>
                <td className="text-white/60">{inv.email ?? "—"}</td>
                <td className="text-white/60">
                  {inv.useCount} / {inv.maxUses}
                </td>
                <td className="text-white/60">{inv.expiresAt ? formatDateTime(inv.expiresAt) : "Jamais"}</td>
                <td>
                  <Badge tone={inv.useCount >= inv.maxUses ? "neutral" : "success"}>
                    {inv.useCount >= inv.maxUses ? "Épuisée" : "Disponible"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export default function AdminInvitationsPage() {
  return (
    <AdminShell>
      <PageHeader title="Invitations" description="RailCards est en mode invitation uniquement." />
      <div className="space-y-4">
        <CreateInvitationForm />
        <InvitationsList />
      </div>
    </AdminShell>
  );
}
