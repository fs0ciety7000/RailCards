"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Swords, Trophy } from "lucide-react";
import { Badge, Button, Card, CardBody, ConfirmDialog, CrAmount, Dialog, EmptyState, ErrorState, RarityBadge, Skeleton, Tabs, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { CombatCardPicker } from "@/components/CombatCardPicker";
import { duelsApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { DUEL_STATUS_LABELS, DUEL_STAT_LABELS, formatDateTime } from "@/lib/format";
import type { Duel } from "@/lib/types";

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "danger" | "info"> = {
  PENDING: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

function AcceptDuelDialog({ duel, open, onClose }: { duel: Duel; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cardInstanceId, setCardInstanceId] = useState<string | null>(null);

  const acceptMutation = useMutation({
    mutationFn: () => duelsApi.accept(duel.id, cardInstanceId!),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Duel résolu" });
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["duels"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible d'accepter", description: getErrorMessage(err) }),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Choisissez votre carte" description={`Mise en jeu : ${duel.wagerCr} CR`} className="max-w-lg">
      <CombatCardPicker selectedId={cardInstanceId} onSelect={setCardInstanceId} />
      <Button fullWidth className="mt-3" disabled={!cardInstanceId} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
        Accepter le duel
      </Button>
    </Dialog>
  );
}

function DuelResult({ duel, myUserId }: { duel: Duel; myUserId?: string }) {
  if (duel.status !== "ACCEPTED" || !duel.stat) return null;
  const iWon = duel.winnerId === myUserId;
  const isDraw = duel.winnerId === null;
  return (
    <div className="mt-3 rounded-lg border border-rc-border bg-white/[0.03] p-3 text-sm">
      <p className="mb-1 font-semibold text-white">
        Statistique tirée au sort : {DUEL_STAT_LABELS[duel.stat] ?? duel.stat}
      </p>
      <p className="text-white/70">
        {duel.challenger.username} : {duel.challengerValue} — {duel.opponent.username} : {duel.opponentValue}
      </p>
      <p className={`mt-1 font-semibold ${isDraw ? "text-white/60" : iWon ? "text-emerald-400" : "text-rc-danger"}`}>
        {isDraw
          ? "Égalité — mise remboursée, personne ne gagne."
          : iWon
            ? `Victoire ! +${duel.wagerCr} CR`
            : `Défaite — -${duel.wagerCr} CR`}
      </p>
    </div>
  );
}

function DuelCard({ duel, myUsername, myUserId }: { duel: Duel; myUsername?: string; myUserId?: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"decline" | "cancel" | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);

  const isChallenger = duel.challenger.username === myUsername;
  const counterparty = isChallenger ? duel.opponent : duel.challenger;

  const respondMutation = useMutation({
    mutationFn: async () => {
      if (confirm === "decline") await duelsApi.decline(duel.id);
      else await duelsApi.cancel(duel.id);
    },
    onSuccess: () => {
      toast.show({ tone: "success", title: confirm === "decline" ? "Défi refusé" : "Défi annulé" });
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ["duels"] });
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Action impossible", description: getErrorMessage(err) });
      setConfirm(null);
    },
  });

  const canAccept = duel.status === "PENDING" && !isChallenger;
  const canCancel = duel.status === "PENDING" && isChallenger;

  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">
            {isChallenger ? "Défi envoyé à" : "Défi reçu de"} @{counterparty.username}
          </p>
          <Badge tone={STATUS_TONE[duel.status] ?? "neutral"}>{DUEL_STATUS_LABELS[duel.status] ?? duel.status}</Badge>
        </div>
        <p className="mb-3 text-xs text-white/40">{formatDateTime(duel.createdAt)}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-white/40">Carte du challenger</p>
            <RarityBadge
              label={duel.challengerCardInstance.cardDefinition.name}
              colorHex={duel.challengerCardInstance.cardDefinition.rarity.colorHex}
              size="sm"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-white/40">Carte de l&apos;adversaire</p>
            {duel.opponentCardInstance ? (
              <RarityBadge
                label={duel.opponentCardInstance.cardDefinition.name}
                colorHex={duel.opponentCardInstance.cardDefinition.rarity.colorHex}
                size="sm"
              />
            ) : (
              <p className="text-white/40">En attente…</p>
            )}
          </div>
        </div>

        <p className="mt-3">
          <Badge tone="accent">
            Mise : <CrAmount value={duel.wagerCr} />
          </Badge>
        </p>

        {duel.message && <p className="mt-3 rounded-lg bg-white/5 p-2 text-sm italic text-white/70">&laquo; {duel.message} &raquo;</p>}

        <DuelResult duel={duel} myUserId={myUserId} />

        {(canAccept || canCancel) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {canAccept && (
              <>
                <Button size="sm" onClick={() => setAcceptOpen(true)}>
                  Accepter
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm("decline")}>
                  Refuser
                </Button>
              </>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => setConfirm("cancel")}>
                Annuler
              </Button>
            )}
          </div>
        )}
      </CardBody>

      <AcceptDuelDialog duel={duel} open={acceptOpen} onClose={() => setAcceptOpen(false)} />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => respondMutation.mutate()}
        loading={respondMutation.isPending}
        destructive
        title={confirm === "decline" ? "Refuser ce défi ?" : "Annuler ce défi ?"}
        description="Cette action est définitive."
        confirmLabel={confirm === "decline" ? "Refuser" : "Annuler le défi"}
      />
    </Card>
  );
}

function DuelsContent() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const duelsQuery = useQuery({ queryKey: ["duels", tab], queryFn: () => duelsApi.list(tab) });

  return (
    <div>
      <PageHeader
        title="Duels"
        description="Défiez d'autres joueurs sur les statistiques de combat de vos cartes."
        actions={
          <Link href="/duels/new">
            <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Nouveau duel
            </Button>
          </Link>
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "received", label: "Reçus" },
            { id: "sent", label: "Envoyés" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as "received" | "sent")}
        />
      </div>

      {duelsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : duelsQuery.isError ? (
        <ErrorState description={getErrorMessage(duelsQuery.error)} action={<Button onClick={() => duelsQuery.refetch()}>Réessayer</Button>} />
      ) : duelsQuery.data!.length === 0 ? (
        <EmptyState
          icon={<Swords />}
          title={tab === "received" ? "Aucun défi reçu" : "Aucun défi envoyé"}
          description="Lancez un défi depuis une carte dotée de statistiques de combat."
          action={
            <Link href="/duels/new">
              <Button icon={<Trophy className="h-4 w-4" aria-hidden="true" />}>Nouveau duel</Button>
            </Link>
          }
        />
      ) : (
        <Stagger className="space-y-3">
          {duelsQuery.data!.map((duel) => (
            <StaggerItem key={duel.id}>
              <DuelCard duel={duel} myUsername={meQuery.data?.username} myUserId={meQuery.data?.id} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function DuelsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <DuelsContent />
      </AppShell>
    </RequireAuth>
  );
}
