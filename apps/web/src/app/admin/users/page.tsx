"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, ShieldCheck, Search, Wallet, Gift, Signature, RotateCcw, Trash2 } from "lucide-react";
import {
  adjustWalletSchema,
  grantCardSchema,
  mintSignatureCardSchema,
  type AdjustWalletInput,
  type GrantCardInput,
  type MintSignatureCardInput,
} from "@railcards/contracts";
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
  Select,
  Skeleton,
  useToast,
} from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { AdminUserRow, CardDefinition } from "@/lib/types";

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

function GrantCardDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const toast = useToast();
  const cardsQuery = useQuery({
    queryKey: ["admin", "cards", "all"],
    queryFn: () => adminApi.listCards({ pageSize: 500 }),
    enabled: !!user,
  });
  const sortedCards = [...(cardsQuery.data?.items ?? [])].sort((a: CardDefinition, b: CardDefinition) => a.name.localeCompare(b.name));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GrantCardInput>({ resolver: zodResolver(grantCardSchema), defaultValues: { cardDefinitionId: "", quantity: 1 } });

  const mutation = useMutation({
    mutationFn: (values: GrantCardInput) => adminApi.grantCard(user!.id, values),
    onSuccess: (result) => {
      toast.show({ tone: "success", title: `${result.granted} carte(s) offerte(s)` });
      reset({ cardDefinitionId: "", quantity: 1 });
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  function close() {
    reset({ cardDefinitionId: "", quantity: 1 });
    onClose();
  }

  return (
    <Dialog
      open={!!user}
      onClose={close}
      title="Donner une carte"
      description={user ? `${user.displayName} (@${user.username})` : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="grant-card-form" loading={mutation.isPending}>
            Offrir
          </Button>
        </>
      }
    >
      {user && (
        <form id="grant-card-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-3">
          <FieldGroup>
            <Label htmlFor="cardDefinitionId">Carte</Label>
            <Select id="cardDefinitionId" invalid={!!errors.cardDefinitionId} disabled={cardsQuery.isLoading} {...register("cardDefinitionId")}>
              <option value="">Sélectionnez</option>
              {sortedCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.series.name} ({c.rarity.label})
                </option>
              ))}
            </Select>
            <FieldError>{errors.cardDefinitionId?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="quantity">Quantité</Label>
            <Input id="quantity" type="number" min={1} max={50} invalid={!!errors.quantity} {...register("quantity")} />
            <FieldError>{errors.quantity?.message}</FieldError>
          </FieldGroup>
        </form>
      )}
    </Dialog>
  );
}

function MintSignatureCardDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const toast = useToast();
  const cardsQuery = useQuery({
    queryKey: ["admin", "cards", "all"],
    queryFn: () => adminApi.listCards({ pageSize: 500 }),
    enabled: !!user,
  });
  const sortedCards = [...(cardsQuery.data?.items ?? [])].sort((a: CardDefinition, b: CardDefinition) => a.name.localeCompare(b.name));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MintSignatureCardInput>({
    resolver: zodResolver(mintSignatureCardSchema),
    defaultValues: { cardDefinitionId: "", editionSize: 1 },
  });

  const mutation = useMutation({
    mutationFn: (values: MintSignatureCardInput) => adminApi.mintSignatureCard(user!.id, values),
    onSuccess: (result) => {
      toast.show({
        tone: "success",
        title: "Carte signature créée",
        description: `Exemplaire Nº${result.signatureNumber}/${result.signatureEdition}`,
      });
      reset({ cardDefinitionId: "", editionSize: 1 });
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  function close() {
    reset({ cardDefinitionId: "", editionSize: 1 });
    onClose();
  }

  return (
    <Dialog
      open={!!user}
      onClose={close}
      title="Créer une carte signature"
      description={user ? `${user.displayName} (@${user.username}) — numérotée, réservée aux événements spéciaux` : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="mint-signature-card-form" loading={mutation.isPending}>
            Créer
          </Button>
        </>
      }
    >
      {user && (
        <form id="mint-signature-card-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-3">
          <FieldGroup>
            <Label htmlFor="mint-cardDefinitionId">Carte</Label>
            <Select
              id="mint-cardDefinitionId"
              invalid={!!errors.cardDefinitionId}
              disabled={cardsQuery.isLoading}
              {...register("cardDefinitionId")}
            >
              <option value="">Sélectionnez</option>
              {sortedCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.series.name} ({c.rarity.label})
                </option>
              ))}
            </Select>
            <FieldError>{errors.cardDefinitionId?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="editionSize">Taille de l&rsquo;édition</Label>
            <Input id="editionSize" type="number" min={1} max={100} invalid={!!errors.editionSize} {...register("editionSize")} />
            <p className="mt-1 text-xs text-white/40">
              Ignorée si cette carte a déjà un exemplaire signature : la taille du premier exemplaire fait foi. Laisser à 1 pour un
              1/1.
            </p>
            <FieldError>{errors.editionSize?.message}</FieldError>
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
  const [grantCardTarget, setGrantCardTarget] = useState<AdminUserRow | null>(null);
  const [mintSignatureTarget, setMintSignatureTarget] = useState<AdminUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
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

  const resetCardsMutation = useMutation({
    mutationFn: () => adminApi.resetUserCards(resetTarget!.id),
    onSuccess: (result) => {
      toast.show({ tone: "success", title: `${result.instancesRemoved} carte(s) supprimée(s)` });
      setResetTarget(null);
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) });
      setResetTarget(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => adminApi.deleteUser(deleteTarget!.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Compte supprimé" });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Échec de la suppression", description: getErrorMessage(err) });
      setDeleteTarget(null);
    },
  });

  return (
    <AdminShell>
      <PageHeader
        title="Utilisateurs"
        description="Rechercher, suspendre, réactiver, offrir des cartes, réinitialiser une collection ou supprimer un compte."
      />
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
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Gift className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setGrantCardTarget(u)}
                        >
                          Carte
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Signature className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setMintSignatureTarget(u)}
                        >
                          Signature
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setResetTarget(u)}
                          className="hover:bg-rc-danger/10"
                          style={{ color: "var(--color-rc-danger)" }}
                        >
                          Reset cartes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setDeleteTarget(u)}
                          className="hover:bg-rc-danger/10"
                          style={{ color: "var(--color-rc-danger)" }}
                        >
                          Supprimer
                        </Button>
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
      <GrantCardDialog user={grantCardTarget} onClose={() => setGrantCardTarget(null)} />
      <MintSignatureCardDialog user={mintSignatureTarget} onClose={() => setMintSignatureTarget(null)} />

      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={() => resetCardsMutation.mutate()}
        loading={resetCardsMutation.isPending}
        destructive
        title="Réinitialiser la collection de ce joueur ?"
        description={
          resetTarget
            ? `Toutes les cartes possédées par ${resetTarget.displayName} (@${resetTarget.username}) seront supprimées définitivement, ainsi que l'historique d'échanges et de ventes qui leur est lié. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Réinitialiser"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteUserMutation.mutate()}
        loading={deleteUserMutation.isPending}
        destructive
        title="Supprimer définitivement ce compte ?"
        description={
          deleteTarget
            ? `Le compte de ${deleteTarget.displayName} (@${deleteTarget.username}) sera effacé pour toujours : cartes, échanges, ventes, portefeuille, missions et notifications. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer définitivement"
      />
    </AdminShell>
  );
}

export default function AdminUsersPage() {
  return <AdminUsersContent />;
}
