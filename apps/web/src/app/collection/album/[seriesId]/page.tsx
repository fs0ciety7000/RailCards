"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { Button, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardFrame } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { AlbumSeriesCard } from "@/lib/types";

/** An un-owned slot: a silhouette that hints at rarity without spoiling the art or name. */
function MysterySlot({ card }: { card: AlbumSeriesCard }) {
  const hex = card.rarity.colorHex;
  return (
    <div
      className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-rc-night-light/60 text-center"
      style={{ borderColor: `${hex}55` }}
    >
      <Lock className="h-6 w-6" style={{ color: hex }} aria-hidden="true" />
      <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: hex }}>
        {card.rarity.label}
      </span>
    </div>
  );
}

function AlbumSeriesContent() {
  const params = useParams<{ seriesId: string }>();
  const query = useQuery({
    queryKey: ["collection", "album", params.seriesId],
    queryFn: () => collectionApi.albumSeries(params.seriesId),
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

  const data = query.data!;
  const ownedCount = data.cards.filter((c) => c.owned).length;

  return (
    <div>
      <PageHeader
        title={data.name}
        description={`${ownedCount}/${data.cards.length} carte(s) obtenue(s)`}
        actions={
          <Link href="/collection/album">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Retour
            </Button>
          </Link>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.cards.map((c) => (
          <StaggerItem key={c.id}>
            {c.owned ? (
              <CardFrame
                card={{ name: c.name!, rarity: c.rarity, imageUrl: c.imageUrl! }}
                className="relative aspect-[3/4] w-full"
              />
            ) : (
              <MysterySlot card={c} />
            )}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export default function AlbumSeriesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <AlbumSeriesContent />
      </AppShell>
    </RequireAuth>
  );
}
