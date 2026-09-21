"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, CardBody, EmptyState, ErrorState, ProgressBar, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
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
            <Button variant="outline" size="sm">
              🗂️ Vue grille
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
        <div className="grid gap-3 sm:grid-cols-2">
          {albumQuery.data!.map((s) => (
            <Card key={s.seriesId}>
              <CardBody>
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-semibold text-white">{s.name}</p>
                  <span className="text-xs font-bold text-rc-accent">{s.completionPct}%</span>
                </div>
                <p className="mb-3 text-xs text-white/50">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</p>
                <ProgressBar value={s.ownedUniqueCards} max={s.totalCards} />
              </CardBody>
            </Card>
          ))}
        </div>
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
