"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  CrAmount,
  EmptyState,
  ErrorState,
  RarityBadge,
  Skeleton,
  Tabs,
  useToast,
} from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { tradesApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { TRADE_STATUS_LABELS, formatDateTime } from "@/lib/format";
import type { Trade } from "@/lib/types";

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "danger" | "info"> = {
  PENDING: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  COUNTERED: "accent",
};

function TradeCard({ trade, myUsername }: { trade: Trade; myUsername?: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"accept" | "reject" | "cancel" | null>(null);

  const isInitiator = trade.initiator.username === myUsername;
  const counterparty = isInitiator ? trade.recipient : trade.initiator;
  const offered = trade.items.filter((i) => i.side === "INITIATOR");
  const requested = trade.items.filter((i) => i.side === "RECIPIENT");

  const mutation = useMutation({
    mutationFn: () => {
      if (confirm === "accept") return tradesApi.accept(trade.id);
      if (confirm === "reject") return tradesApi.reject(trade.id);
      return tradesApi.cancel(trade.id);
    },
    onSuccess: () => {
      toast.show({ tone: "success", title: "Échange mis à jour" });
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Action impossible", description: getErrorMessage(err) });
      setConfirm(null);
    },
  });

  const canRespond = trade.status === "PENDING" && !isInitiator;
  const canCancel = trade.status === "PENDING" && isInitiator;

  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">
            {isInitiator ? "Envoyé à" : "Reçu de"} @{counterparty.username}
          </p>
          <Badge tone={STATUS_TONE[trade.status] ?? "neutral"}>{TRADE_STATUS_LABELS[trade.status] ?? trade.status}</Badge>
        </div>
        <p className="mb-3 text-xs text-white/40">{formatDateTime(trade.createdAt)}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-white/40">
              {isInitiator ? "Vous proposez" : "Il/elle propose"}
            </p>
            <TradeItemsList items={offered} cr={trade.initiatorCr} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-white/40">
              {isInitiator ? "Vous demandez" : "Il/elle demande"}
            </p>
            <TradeItemsList items={requested} cr={trade.recipientCr} />
          </div>
        </div>

        {trade.message && <p className="mt-3 rounded-lg bg-white/5 p-2 text-sm italic text-white/70">&laquo; {trade.message} &raquo;</p>}

        {(canRespond || canCancel) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {canRespond && (
              <>
                <Button size="sm" onClick={() => setConfirm("accept")}>
                  Accepter
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm("reject")}>
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

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        destructive={confirm === "reject" || confirm === "cancel"}
        title={
          confirm === "accept" ? "Accepter cet échange ?" : confirm === "reject" ? "Refuser cet échange ?" : "Annuler cet échange ?"
        }
        description="Cette action est définitive et les cartes/CR concernés changeront immédiatement de propriétaire."
        confirmLabel={confirm === "accept" ? "Accepter" : confirm === "reject" ? "Refuser" : "Annuler l'échange"}
      />
    </Card>
  );
}

function TradeItemsList({ items, cr }: { items: Trade["items"]; cr: number }) {
  if (items.length === 0 && cr === 0) return <p className="text-white/40">Rien</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <RarityBadge
            label={item.cardInstance.cardDefinition.name}
            colorHex={item.cardInstance.cardDefinition.rarity.colorHex}
            size="sm"
          />
        </li>
      ))}
      {cr > 0 && (
        <li>
          <Badge tone="accent">
            <CrAmount value={cr} />
          </Badge>
        </li>
      )}
    </ul>
  );
}

function TradesContent() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const tradesQuery = useQuery({
    queryKey: ["trades", tab],
    queryFn: () => tradesApi.list(tab),
  });

  return (
    <div>
      <PageHeader
        title="Échanges"
        description="Proposez et gérez vos échanges de cartes."
        actions={
          <Link href="/trades/new">
            <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Nouvel échange
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

      {tradesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : tradesQuery.isError ? (
        <ErrorState description={getErrorMessage(tradesQuery.error)} action={<Button onClick={() => tradesQuery.refetch()}>Réessayer</Button>} />
      ) : tradesQuery.data!.length === 0 ? (
        <EmptyState
          icon={<Repeat />}
          title={tab === "received" ? "Aucun échange reçu" : "Aucun échange envoyé"}
          description="Proposez un échange depuis une carte de votre collection."
          action={
            <Link href="/trades/new">
              <Button>Proposer un échange</Button>
            </Link>
          }
        />
      ) : (
        <Stagger className="space-y-3">
          {tradesQuery.data!.map((trade) => (
            <StaggerItem key={trade.id}>
              <TradeCard trade={trade} myUsername={meQuery.data?.username} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function TradesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TradesContent />
      </AppShell>
    </RequireAuth>
  );
}
