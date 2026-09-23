"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Gavel } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  CrAmount,
  ErrorState,
  FieldError,
  FieldGroup,
  Input,
  Label,
  RarityBadge,
  Skeleton,
  useToast,
} from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { marketApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime, formatTimeLeft } from "@/lib/format";
import { CombatStatsPanel, parseCombatStats } from "@/components/CombatStatsPanel";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";

function ListingDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const listingQuery = useQuery({
    queryKey: ["market", "listing", params.id],
    queryFn: () => marketApi.listingById(params.id),
    refetchInterval: 10_000,
  });
  const cardDefinitionId = listingQuery.data?.cardInstance.cardDefinitionId;
  const priceHistoryQuery = useQuery({
    queryKey: ["market", "price-history", cardDefinitionId],
    queryFn: () => marketApi.priceHistory(cardDefinitionId!, 30),
    enabled: !!cardDefinitionId,
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

  const bidMutation = useMutation({
    mutationFn: (amountCr: number) => marketApi.bid(params.id, amountCr),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Enchère placée" });
      setBidAmount("");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void listingQuery.refetch();
    },
    onError: (err) => toast.show({ tone: "error", title: "Enchère refusée", description: getErrorMessage(err) }),
  });

  const settleMutation = useMutation({
    mutationFn: () => marketApi.settle(params.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Enchère clôturée" });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["market"] });
      void listingQuery.refetch();
    },
    onError: (err) => toast.show({ tone: "error", title: "Clôture impossible", description: getErrorMessage(err) }),
  });

  // Auto-refresh so the countdown reaching zero flips the UI to the
  // "closing…" state without waiting for the next 10s poll.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
  const isAuction = listing.listingType === "AUCTION";
  const isExpired = isAuction && listing.auctionEndsAt ? new Date(listing.auctionEndsAt).getTime() - now <= 0 : false;
  const isLeadingBidder = isAuction && listing.currentBidderId === meQuery.data?.id;
  const minBid = listing.currentBidCr != null ? listing.currentBidCr + 1 : listing.priceCr;

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
        {isAuction && (
          <Badge tone="accent" className="flex items-center gap-1">
            <Gavel className="h-3 w-3" aria-hidden="true" />
            Enchère
          </Badge>
        )}
        {isSold && <Badge tone="danger">{listing.status === "SOLD" ? "Vendue" : "Annulée"}</Badge>}
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{card.name}</h1>
      <p className="mt-1 text-sm text-white/60">Vendue par @{listing.seller.username}</p>
      <p className="mt-1 text-xs text-white/40">Mise en vente le {formatDateTime(listing.createdAt)}</p>

      {combatStats && <CombatStatsPanel stats={combatStats} colorHex={card.rarity.colorHex} />}

      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">{isAuction ? "Mise actuelle" : "Prix"}</p>
            <p className="text-2xl font-bold tracking-tight">
              <CrAmount value={isAuction ? (listing.currentBidCr ?? listing.priceCr) : listing.priceCr} className="text-rc-accent" />
            </p>
          </div>
          {isAuction && listing.currentBidder && (
            <p className="text-xs text-white/50">
              Meilleure offre par @{listing.currentBidder.username}
              {isLeadingBidder && " (vous)"}
            </p>
          )}
          {isAuction && listing.status === "ACTIVE" && listing.auctionEndsAt && (
            <p className="text-xs text-white/50">{isExpired ? "Enchère terminée" : `Se termine dans ${formatTimeLeft(listing.auctionEndsAt)}`}</p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardBody>
          <p className="mb-3 text-sm font-semibold text-white">Historique des prix (30 jours)</p>
          {priceHistoryQuery.isLoading ? (
            <Skeleton className="h-[140px] w-full" />
          ) : (
            <PriceHistoryChart points={priceHistoryQuery.data ?? []} />
          )}
        </CardBody>
      </Card>

      {isAuction && listing.status === "ACTIVE" && isExpired && (
        <Button fullWidth className="mt-4" loading={settleMutation.isPending} onClick={() => settleMutation.mutate()}>
          Clôturer l&apos;enchère
        </Button>
      )}

      {isAuction && listing.status === "ACTIVE" && !isExpired && !isOwn && (
        <Card className="mt-4">
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amount = Number(bidAmount);
                if (Number.isFinite(amount) && amount >= minBid) bidMutation.mutate(amount);
              }}
            >
              <FieldGroup>
                <Label htmlFor="bidAmount">Votre enchère (min. {minBid.toLocaleString("fr-BE")} CR)</Label>
                <Input
                  id="bidAmount"
                  type="number"
                  min={minBid}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  invalid={bidAmount !== "" && Number(bidAmount) < minBid}
                />
                {bidAmount !== "" && Number(bidAmount) < minBid && (
                  <FieldError>{`L'enchère doit être d'au moins ${minBid} CR.`}</FieldError>
                )}
              </FieldGroup>
              <Button type="submit" fullWidth loading={bidMutation.isPending} disabled={!bidAmount || Number(bidAmount) < minBid}>
                Placer l&apos;enchère
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {isOwn ? (
        !isAuction &&
        listing.status === "ACTIVE" && (
          <Button variant="danger" fullWidth className="mt-4" onClick={() => setCancelOpen(true)}>
            Annuler mon annonce
          </Button>
        )
      ) : !isAuction && listing.status === "ACTIVE" ? (
        <Button fullWidth size="lg" className="mt-4" onClick={() => setBuyOpen(true)}>
          Acheter pour <CrAmount value={listing.priceCr} className="ml-1" />
        </Button>
      ) : (
        listing.status !== "ACTIVE" && <p className="mt-4 text-center text-sm text-white/50">Cette annonce n&apos;est plus disponible.</p>
      )}
      {isAuction && isOwn && listing.status === "ACTIVE" && listing.currentBidderId && (
        <p className="mt-3 text-center text-xs text-white/40">Une enchère est en cours — impossible d&apos;annuler.</p>
      )}
      {isAuction && isOwn && listing.status === "ACTIVE" && !listing.currentBidderId && !isExpired && (
        <Button variant="danger" fullWidth className="mt-4" onClick={() => setCancelOpen(true)}>
          Annuler mon annonce
        </Button>
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
