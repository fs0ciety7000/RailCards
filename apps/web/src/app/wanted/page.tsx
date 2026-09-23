"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ClipboardList, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  RarityBadge,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { CardArt } from "@/components/CardTile";
import { catalogApi, usersApi, wantedApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";
import type { CardDefinition, WantedListing } from "@/lib/types";

function PostWantedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const resultsQuery = useQuery({
    queryKey: ["cards", "search", debouncedSearch],
    queryFn: () => catalogApi.cards({ search: debouncedSearch, pageSize: 12 }),
    enabled: open && debouncedSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () => wantedApi.create({ cardDefinitionId: selectedCard!.id, note: note || undefined }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Recherche publiée" });
      void queryClient.invalidateQueries({ queryKey: ["wanted"] });
      setSelectedCard(null);
      setSearch("");
      setNote("");
      onClose();
    },
    onError: (err) => toast.show({ tone: "error", title: "Publication impossible", description: getErrorMessage(err) }),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Publier une recherche" description="Indiquez la carte que vous recherchez." className="max-w-lg">
      {selectedCard ? (
        <div>
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-rc-border p-2">
            <div className="w-16 shrink-0">
              <CardArt card={selectedCard} className="aspect-[3/4] w-full" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{selectedCard.name}</p>
              <RarityBadge label={selectedCard.rarity.label} colorHex={selectedCard.rarity.colorHex} size="sm" />
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedCard(null)}>
              Changer
            </Button>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="Ce que vous proposez en échange (optionnel)…"
            rows={3}
          />
          <Button fullWidth className="mt-3" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Publier
          </Button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une carte par nom…"
              className="pl-9"
            />
          </div>
          <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {resultsQuery.data?.items.map((card) => (
              <button
                type="button"
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className="rounded-xl text-left transition-colors hover:bg-white/[0.04]"
              >
                <CardArt card={card} className="aspect-[3/4] w-full" />
              </button>
            ))}
            {debouncedSearch.length >= 2 && resultsQuery.data?.items.length === 0 && (
              <p className="col-span-full text-sm text-white/50">Aucune carte trouvée.</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function WantedCard({ listing, myUsername, mine }: { listing: WantedListing; myUsername?: string; mine: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const transitionMutation = useMutation({
    mutationFn: (action: "fulfill" | "cancel") => (action === "fulfill" ? wantedApi.fulfill(listing.id) : wantedApi.cancel(listing.id)),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Recherche mise à jour" });
      void queryClient.invalidateQueries({ queryKey: ["wanted"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Action impossible", description: getErrorMessage(err) }),
  });

  const isMine = listing.poster.username === myUsername;

  return (
    <Card>
      <CardBody className="flex gap-3">
        <div className="w-16 shrink-0">
          <CardArt card={listing.cardDefinition} className="aspect-[3/4] w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-white">{listing.cardDefinition.name}</p>
            {!mine && <Badge tone="neutral">{listing.status === "OPEN" ? "Ouverte" : listing.status === "FULFILLED" ? "Pourvue" : "Annulée"}</Badge>}
          </div>
          <RarityBadge label={listing.cardDefinition.rarity.label} colorHex={listing.cardDefinition.rarity.colorHex} size="sm" />
          <p className="mt-1 text-sm text-white/60">
            Recherchée par @{listing.poster.username} · {formatDateTime(listing.createdAt)}
          </p>
          {listing.note && <p className="mt-2 rounded-lg bg-white/5 p-2 text-sm italic text-white/70">&laquo; {listing.note} &raquo;</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {!isMine && listing.status === "OPEN" && (
              <Link href={`/trades/new?recipientUsername=${listing.poster.username}`}>
                <Button size="sm" icon={<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />}>
                  Proposer un échange
                </Button>
              </Link>
            )}
            {isMine && listing.status === "OPEN" && (
              <>
                <Button size="sm" variant="outline" loading={transitionMutation.isPending} onClick={() => transitionMutation.mutate("fulfill")}>
                  Marquer pourvue
                </Button>
                <Button size="sm" variant="danger" loading={transitionMutation.isPending} onClick={() => transitionMutation.mutate("cancel")}>
                  Annuler
                </Button>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function WantedContent() {
  const [tab, setTab] = useState<"board" | "mine">("board");
  const [postOpen, setPostOpen] = useState(false);
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });

  const boardQuery = useQuery({
    queryKey: ["wanted", "board"],
    queryFn: () => wantedApi.list({ pageSize: 50 }),
    enabled: tab === "board",
  });
  const mineQuery = useQuery({
    queryKey: ["wanted", "mine"],
    queryFn: () => wantedApi.mine(),
    enabled: tab === "mine",
  });

  const items = tab === "board" ? (boardQuery.data?.items ?? []) : (mineQuery.data ?? []);
  const isLoading = tab === "board" ? boardQuery.isLoading : mineQuery.isLoading;
  const isError = tab === "board" ? boardQuery.isError : mineQuery.isError;
  const error = tab === "board" ? boardQuery.error : mineQuery.error;
  const refetch = tab === "board" ? boardQuery.refetch : mineQuery.refetch;

  return (
    <div>
      <PageHeader
        title="Petites annonces"
        description="Publiez la carte que vous cherchez ; les autres joueurs peuvent vous proposer un échange."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setPostOpen(true)}>
            Publier une recherche
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "board", label: "Toutes les recherches" },
            { id: "mine", label: "Mes recherches" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as "board" | "mine")}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState description={getErrorMessage(error)} action={<Button onClick={() => refetch()}>Réessayer</Button>} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={tab === "board" ? "Aucune recherche en cours" : "Vous n'avez publié aucune recherche"}
          description="Publiez la carte que vous cherchez pour que d'autres joueurs puissent vous répondre."
          action={<Button onClick={() => setPostOpen(true)}>Publier une recherche</Button>}
        />
      ) : (
        <Stagger className="space-y-3">
          {items.map((listing) => (
            <StaggerItem key={listing.id}>
              <WantedCard listing={listing} myUsername={meQuery.data?.username} mine={tab === "mine"} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <PostWantedDialog open={postOpen} onClose={() => setPostOpen(false)} />
    </div>
  );
}

export default function WantedPage() {
  return (
    <RequireAuth>
      <AppShell>
        <WantedContent />
      </AppShell>
    </RequireAuth>
  );
}
