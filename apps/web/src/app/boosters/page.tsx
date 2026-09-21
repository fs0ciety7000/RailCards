"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
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
  const [openedBooster, setOpenedBooster] = useState<BoosterDefinition | null>(null);
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
