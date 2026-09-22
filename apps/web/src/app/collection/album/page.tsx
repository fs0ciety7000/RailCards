"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { Button, Card, CardBody, EmptyState, ErrorState, ProgressBar, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";

function AlbumContent() {
  const albumQuery = useQuery({ queryKey: ["collection", "album"], queryFn: collectionApi.album });

  return (
    <div>
      <PageHeader
        title="Album de collection"
        description="Progression de complétion par série."
        actions={
          <Link href="/collection">
            <Button variant="outline" size="sm" icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}>
              Vue grille
            </Button>
          </Link>
        }
      />

      {albumQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : albumQuery.isError ? (
        <ErrorState description={getErrorMessage(albumQuery.error)} action={<Button onClick={() => albumQuery.refetch()}>Réessayer</Button>} />
      ) : albumQuery.data!.length === 0 ? (
        <EmptyState title="Aucune série active" />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {albumQuery.data!.map((s) => (
            <StaggerItem key={s.seriesId}>
              <Link href={`/collection/album/${s.seriesId}`} className="block">
                <Card className="transition-colors hover:bg-white/[0.04]">
                  <CardBody>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-semibold tracking-tight text-white">{s.name}</p>
                      <span className="text-xs font-bold text-rc-accent">{s.completionPct}%</span>
                    </div>
                    <p className="mb-3 text-xs text-white/50">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</p>
                    <ProgressBar value={s.ownedUniqueCards} max={s.totalCards} />
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

export default function AlbumPage() {
  return (
    <RequireAuth>
      <AppShell>
        <AlbumContent />
      </AppShell>
    </RequireAuth>
  );
}
