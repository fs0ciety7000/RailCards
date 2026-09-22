"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, ShieldCheck, Search, Wallet } from "lucide-react";
import { adjustWalletSchema, type AdjustWalletInput } from "@railcards/contracts";
import { Badge, Button, Card, CardBody, ConfirmDialog, Dialog, FieldError, FieldGroup, Input, Label, Skeleton, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { AdminUserRow } from "@/lib/types";

function StatusAction({
  user,
  onSuspend,
  onReactivate,
}: {
  user: AdminUserRow;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  if (user.role === "ADMIN") return null;
  return user.status === "ACTIVE" ? (
    <Button
      size="sm"
      variant="ghost"
      icon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
      onClick={onSuspend}
      className="hover:bg-rc-danger/10"
      style={{ color: "var(--color-rc-danger)" }}
    >
      Suspendre
    </Button>
  ) : (
    <Button size="sm" variant="outline" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onReactivate}>
      Réactiver
    </Button>
  );
}

function WalletAdjustmentDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustWalletInput>({ resolver: zodResolver(adjustWalletSchema), defaultValues: { amount: 0, reason: "" } });

  const mutation = useMutation({
    mutationFn: (values: AdjustWalletInput) => adminApi.adjustWallet(user!.id, { amount: values.amount, reason: values.reason || undefined }),
    onSuccess: (result) => {
      toast.show({ tone: "success", title: "Solde mis à jour", description: `Nouveau solde : ${result.balance.toLocaleString("fr-BE")} CR` });
      reset({ amount: 0, reason: "" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec de l'ajustement", description: getErrorMessage(err) }),
  });

  function close() {
    reset({ amount: 0, reason: "" });
    onClose();
  }

  return (
    <Dialog
      open={!!user}
      onClose={close}
      title="Modifier le solde"
      description={user ? `${user.displayName} (@${user.username}) — solde actuel : ${user.balance.toLocaleString("fr-BE")} CR` : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="wallet-adjustment-form" loading={mutation.isPending}>
            Appliquer
          </Button>
        </>
      }
    >
      {user && (
        <form id="wallet-adjustment-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
          <FieldGroup>
            <Label htmlFor="amount">Montant (CR)</Label>
            <Input id="amount" type="number" step={1} invalid={!!errors.amount} {...register("amount")} />
            <p className="mt-1 text-xs text-white/40">Positif pour créditer, négatif pour débiter.</p>
            <FieldError>{errors.amount?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Input id="reason" invalid={!!errors.reason} {...register("reason")} />
            <FieldError>{errors.reason?.message}</FieldError>
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function AdminUsersContent() {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ id: string; action: "suspend" | "reactivate" } | null>(null);
  const [walletTarget, setWalletTarget] = useState<AdminUserRow | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => adminApi.listUsers({ search: search || undefined, pageSize: 50 }),
  });

  const mutation = useMutation({
    mutationFn: () => (target!.action === "suspend" ? adminApi.suspendUser(target!.id) : adminApi.reactivateUser(target!.id)),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Compte mis à jour" });
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) });
      setTarget(null);
    },
  });

  return (
    <AdminShell>
      <PageHeader title="Utilisateurs" description="Rechercher, suspendre, réactiver des comptes ou modifier leur solde." />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
        <Input
          aria-label="Rechercher un utilisateur"
          placeholder="Rechercher par nom d'utilisateur ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card>
        <CardBody className="overflow-x-auto">
          {usersQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
                  <th className="py-2.5 pr-4">Utilisateur</th>
                  <th className="pr-4">Email</th>
                  <th className="pr-4">Rôle</th>
                  <th className="pr-4">Statut</th>
                  <th className="whitespace-nowrap pr-4 text-right">Solde</th>
                  <th className="whitespace-nowrap pr-4">Inscrit le</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                    <td className="py-2.5 pr-4 font-medium text-white">
                      {u.displayName} <span className="text-white/40">@{u.username}</span>
                    </td>
                    <td className="pr-4 text-white/60">{u.email}</td>
                    <td className="pr-4 text-white/60">{u.role}</td>
                    <td className="pr-4">
                      <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap pr-4 text-right text-white/80">{u.balance.toLocaleString("fr-BE")} CR</td>
                    <td className="whitespace-nowrap pr-4 text-white/60">{formatDate(u.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setWalletTarget(u)}
                        >
                          Solde
                        </Button>
                        <StatusAction
                          user={u}
                          onSuspend={() => setTarget({ id: u.id, action: "suspend" })}
                          onReactivate={() => setTarget({ id: u.id, action: "reactivate" })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        destructive={target?.action === "suspend"}
        title={target?.action === "suspend" ? "Suspendre ce compte ?" : "Réactiver ce compte ?"}
        description={
          target?.action === "suspend"
            ? "Le compte sera immédiatement déconnecté et ne pourra plus se reconnecter."
            : "Le compte pourra de nouveau se connecter normalement."
        }
        confirmLabel={target?.action === "suspend" ? "Suspendre" : "Réactiver"}
      />

      <WalletAdjustmentDialog user={walletTarget} onClose={() => setWalletTarget(null)} />
    </AdminShell>
  );
}

export default function AdminUsersPage() {
  return <AdminUsersContent />;
}
