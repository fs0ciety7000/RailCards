"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";

function MissingContent() {
  const missingQuery = useQuery({ queryKey: ["collection", "missing"], queryFn: () => collectionApi.missing() });

  return (
    <div>
      <PageHeader title="Cartes manquantes" description="Ce qu'il vous reste à trouver, série par série." />

      {missingQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : missingQuery.isError ? (
        <ErrorState description={getErrorMessage(missingQuery.error)} action={<Button onClick={() => missingQuery.refetch()}>Réessayer</Button>} />
      ) : missingQuery.data!.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="Aucune série active" />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {missingQuery.data!.map((s) => (
            <StaggerItem key={s.seriesId}>
              <Link href={`/collection/missing/${s.seriesId}`} className="block">
                <Card className="transition-colors hover:bg-white/[0.04]">
                  <CardBody className="flex gap-3">
                    {s.coverImageUrl && (
                      <img src={s.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-rc-border object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate font-semibold tracking-tight text-white">{s.name}</p>
                        {s.missingCount === 0 ? (
                          <Badge tone="success">Complète</Badge>
                        ) : (
                          <Badge tone="accent">{s.missingCount} manquante{s.missingCount !== 1 ? "s" : ""}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-white/50">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {s.totalCards - s.missingCount}/{s.totalCards} obtenue(s)
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function MissingCardsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <MissingContent />
      </AppShell>
    </RequireAuth>
  );
}
