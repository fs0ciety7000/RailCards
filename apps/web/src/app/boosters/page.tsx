"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Gift, Sparkles } from "lucide-react";
import { Button, Card, CardBody, CrAmount, EmptyState, ErrorState, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BoosterReveal } from "@/components/BoosterReveal";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { boostersApi } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { usePrefersReducedMotion } from "@/lib/motion-prefs";
import type { BoosterDefinition, BoosterOpening } from "@/lib/types";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function FreeBoosterCard({ onClaimed }: { onClaimed: (result: BoosterOpening) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["boosters", "free", "status"], queryFn: boostersApi.freeStatus });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextAvailableAt = statusQuery.data?.nextAvailableAt ? new Date(statusQuery.data.nextAvailableAt).getTime() : null;
  const remainingMs = nextAvailableAt ? nextAvailableAt - now : 0;
  const claimable = statusQuery.data?.claimable || remainingMs <= 0;

  useEffect(() => {
    // Flip the "Réclamer" button on the instant the cooldown hits zero,
    // without waiting for the next status poll.
    if (statusQuery.data && !statusQuery.data.claimable && remainingMs <= 0) {
      void queryClient.invalidateQueries({ queryKey: ["boosters", "free", "status"] });
    }
  }, [remainingMs, statusQuery.data, queryClient]);

  const claimMutation = useMutation({
    mutationFn: boostersApi.claimFree,
    onSuccess: (result) => {
      onClaimed(result);
      void queryClient.invalidateQueries({ queryKey: ["boosters", "free", "status"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Réclamation impossible", description: getErrorMessage(err) }),
  });

  if (statusQuery.isLoading) return <Skeleton className="h-32 w-full" />;
  if (statusQuery.isError) return null;

  return (
    <Card className="relative mb-5 overflow-hidden border-rc-accent/30 bg-gradient-to-br from-rc-accent/10 to-transparent">
      <CardBody className="flex flex-col items-center gap-2 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rc-accent/20 text-rc-accent">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display font-semibold text-white">Booster gratuit</p>
            <p className="text-sm text-white/60">2 cartes offertes, toutes les 4 heures.</p>
          </div>
        </div>
        {claimable ? (
          <Button onClick={() => claimMutation.mutate()} loading={claimMutation.isPending} icon={<Gift className="h-4 w-4" aria-hidden="true" />}>
            Réclamer
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-rc-border bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/70">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCountdown(remainingMs)}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const MAX_NETWORK_RETRIES = 3;

async function openWithRetry(slug: string, idempotencyKey: string): Promise<BoosterOpening> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_NETWORK_RETRIES; attempt++) {
    try {
      return await boostersApi.open(slug, idempotencyKey);
    } catch (err) {
      lastError = err;
      // Only a network-level failure (fetch throwing, not an HTTP error
      // response) is safe and worthwhile to auto-retry with the same key.
      const isNetworkError = !(err instanceof ApiError);
      if (!isNetworkError || attempt === MAX_NETWORK_RETRIES - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

function BoostersContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reduceMotion, setReduceMotion] = usePrefersReducedMotion();
  const [opening, setOpening] = useState<BoosterOpening | null>(null);
  const [openedBooster, setOpenedBooster] = useState<{ name: string } | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const boostersQuery = useQuery({ queryKey: ["boosters"], queryFn: boostersApi.list });

  const openMutation = useMutation({
    mutationFn: (booster: BoosterDefinition) => {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      return openWithRetry(booster.slug, idempotencyKeyRef.current);
    },
    onSuccess: (result, booster) => {
      // The /boosters/open response does not echo the booster definition
      // (only its pulls) — we already have it from the list we opened from.
      setOpening(result);
      setOpenedBooster(booster);
      idempotencyKeyRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (err) => {
      // Keep the same idempotency key so a manual retry (or another
      // network hiccup) can never double-charge the player.
      toast.show({ tone: "error", title: "Ouverture impossible", description: getErrorMessage(err) });
    },
  });

  if (opening) {
    return (
      <div className="relative">
        <div className="bg-aurora" />
        <div className="relative z-10">
          <PageHeader
            title={openedBooster?.name ?? "Booster ouvert"}
            description={`Ouvert le ${new Date(opening.openedAt).toLocaleString("fr-BE")}`}
          />
          <BoosterReveal pulls={opening.pulls} reduceMotion={reduceMotion} onReduceMotionChange={setReduceMotion} />
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => { setOpening(null); setOpenedBooster(null); }} fullWidth>
              Ouvrir un autre booster
            </Button>
            <Link href="/collection" className="flex-1">
              <Button variant="secondary" fullWidth>
                Voir ma collection
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Ouvrir un booster" description="Choisissez un booster et tentez votre chance." />

      <FreeBoosterCard
        onClaimed={(result) => {
          setOpening(result);
          setOpenedBooster({ name: "Booster Gratuit" });
        }}
      />

      {boostersQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : boostersQuery.isError ? (
        <ErrorState description={getErrorMessage(boostersQuery.error)} action={<Button onClick={() => boostersQuery.refetch()}>Réessayer</Button>} />
      ) : boostersQuery.data!.length === 0 ? (
        <EmptyState icon={<Gift />} title="Aucun booster disponible" description="Revenez plus tard." />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boostersQuery.data!.map((b) => (
            <StaggerItem key={b.id}>
              <Card interactive className="h-full overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image src={b.imageUrl} alt="" fill sizes="360px" className="object-cover" unoptimized />
                </div>
                <CardBody>
                  <p className="font-display font-semibold tracking-tight text-white">{b.name}</p>
                  <p className="mt-1 text-sm text-white/60">{b.description}</p>
                  <p className="mt-1.5 text-xs text-white/40">{b.cardCount} carte(s) par booster</p>
                  <div className="mt-3.5 flex items-center justify-between">
                    <CrAmount value={b.priceCr} className="text-rc-accent" />
                    <Button
                      onClick={() => openMutation.mutate(b)}
                      loading={openMutation.isPending && openMutation.variables?.id === b.id}
                      disabled={openMutation.isPending}
                    >
                      Ouvrir
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function BoostersPage() {
  return (
    <RequireAuth>
      <AppShell>
        <BoostersContent />
      </AppShell>
    </RequireAuth>
  );
}
