"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardBody, ConfirmDialog, CrAmount, ErrorState, RarityBadge, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { marketApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";
import { CombatStatsPanel, parseCombatStats } from "@/components/CombatStatsPanel";

function ListingDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const listingQuery = useQuery({
    queryKey: ["market", "listing", params.id],
    queryFn: () => marketApi.listingById(params.id),
  });

  const buyMutation = useMutation({
    mutationFn: () => marketApi.buy(params.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Achat réussi", description: "La carte a rejoint votre collection." });
      setBuyOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["market"] });
      router.push("/collection");
    },
    onError: (err) => {
      setBuyOpen(false);
      toast.show({ tone: "error", title: "Achat impossible", description: getErrorMessage(err) });
      void listingQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => marketApi.cancel(params.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Annonce annulée" });
      setCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["market"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      router.push("/market");
    },
    onError: (err) => {
      setCancelOpen(false);
      toast.show({ tone: "error", title: "Annulation impossible", description: getErrorMessage(err) });
    },
  });

  if (listingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg">
        <Skeleton className="aspect-[3/4] w-full" />
      </div>
    );
  }

  if (listingQuery.isError) {
    return (
      <ErrorState
        title="Annonce introuvable"
        description={getErrorMessage(listingQuery.error)}
        action={
          <Button variant="outline" onClick={() => router.push("/market")}>
            Retour au marché
          </Button>
        }
      />
    );
  }

  const listing = listingQuery.data!;
  const card = listing.cardInstance.cardDefinition;
  const isOwn = meQuery.data?.username === listing.seller.username;
  const isSold = listing.status !== "ACTIVE";
  const combatStats = card.combatStatsEnabled ? parseCombatStats(card.combatStats) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-lg"
    >
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </button>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rc-border shadow-rc-md">
        <Image src={card.imageUrl} alt="" fill sizes="512px" className="object-cover" unoptimized priority />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RarityBadge label={card.rarity.label} colorHex={card.rarity.colorHex} />
        <Badge>{card.series.name}</Badge>
        {isSold && <Badge tone="danger">{listing.status === "SOLD" ? "Vendue" : "Annulée"}</Badge>}
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{card.name}</h1>
      <p className="mt-1 text-sm text-white/60">Vendue par @{listing.seller.username}</p>
      <p className="mt-1 text-xs text-white/40">Mise en vente le {formatDateTime(listing.createdAt)}</p>

      {combatStats && <CombatStatsPanel stats={combatStats} colorHex={card.rarity.colorHex} />}

      <Card className="mt-4">
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-white/60">Prix</p>
          <p className="text-2xl font-bold tracking-tight">
            <CrAmount value={listing.priceCr} className="text-rc-accent" />
          </p>
        </CardBody>
      </Card>

      {isOwn ? (
        listing.status === "ACTIVE" && (
          <Button variant="danger" fullWidth className="mt-4" onClick={() => setCancelOpen(true)}>
            Annuler mon annonce
          </Button>
        )
      ) : listing.status === "ACTIVE" ? (
        <Button fullWidth size="lg" className="mt-4" onClick={() => setBuyOpen(true)}>
          Acheter pour <CrAmount value={listing.priceCr} className="ml-1" />
        </Button>
      ) : (
        <p className="mt-4 text-center text-sm text-white/50">Cette annonce n&apos;est plus disponible.</p>
      )}

      <ConfirmDialog
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        onConfirm={() => buyMutation.mutate()}
        loading={buyMutation.isPending}
        title="Confirmer l'achat"
        description={`Acheter "${card.name}" pour ${listing.priceCr.toLocaleString("fr-BE")} CR ? Cette action est définitive.`}
        confirmLabel="Acheter"
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        loading={cancelMutation.isPending}
        title="Annuler l'annonce"
        description="La carte redeviendra disponible dans votre collection."
        confirmLabel="Annuler l'annonce"
        destructive
      />
    </motion.div>
  );
}

export default function ListingDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <ListingDetailContent />
      </AppShell>
    </RequireAuth>
  );
}
