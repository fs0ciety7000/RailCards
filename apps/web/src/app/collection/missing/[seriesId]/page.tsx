"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardFrame } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function MissingSeriesContent() {
  const params = useParams<{ seriesId: string }>();
  const query = useQuery({
    queryKey: ["collection", "missing", params.seriesId],
    queryFn: () => collectionApi.missing(params.seriesId),
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState title="Série introuvable" description={getErrorMessage(query.error)} />;
  }

  const series = query.data?.[0];
  if (!series) {
    return <ErrorState title="Série introuvable" description="Cette série n'existe pas ou n'est pas active." />;
  }

  return (
    <div>
      <PageHeader
        title={series.name}
        description={`${series.totalCards - series.missingCount}/${series.totalCards} carte(s) obtenue(s)`}
        actions={
          <Link href="/collection/missing">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Retour
            </Button>
          </Link>
        }
      />
      {series.missingCards.length === 0 ? (
        <EmptyState icon={<PartyPopper />} title="Série complète !" description="Vous possédez déjà toutes les cartes de cette série." />
      ) : (
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {series.missingCards.map((c) => (
            <StaggerItem key={c.id}>
              <div className="relative">
                <CardFrame card={c} className="relative aspect-[3/4] w-full opacity-60 grayscale" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-black/70 py-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-white/80">
                  Manquante
                </span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function MissingSeriesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <MissingSeriesContent />
      </AppShell>
    </RequireAuth>
  );
}
