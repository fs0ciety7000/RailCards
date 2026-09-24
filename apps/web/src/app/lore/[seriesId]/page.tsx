"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { Button, Card, CardBody, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { loreApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { LoreEntry } from "@/lib/types";

function LoreEntryCard({ entry }: { entry: LoreEntry }) {
  return (
    <Card>
      <CardBody className="flex gap-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border" style={{ borderColor: entry.rarity.colorHex }}>
          <img
            src={entry.imageUrl}
            alt={entry.name}
            className={`h-full w-full object-cover ${entry.unlocked ? "" : "grayscale"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <p className="truncate font-semibold text-white">{entry.name}</p>
            {!entry.unlocked && <Lock className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />}
          </div>
          <p className="mb-2 text-xs" style={{ color: entry.rarity.colorHex }}>
            {entry.rarity.label}
          </p>
          {entry.unlocked ? (
            <p className="text-sm italic leading-relaxed text-white/70">« {entry.flavorText} »</p>
          ) : (
            <p className="text-sm italic text-white/35">Débloquez cette carte pour lire son histoire.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function LoreSeriesContent() {
  const params = useParams<{ seriesId: string }>();
  const query = useQuery({
    queryKey: ["lore", params.seriesId],
    queryFn: () => loreApi.book(params.seriesId),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState title="Série introuvable" description={getErrorMessage(query.error)} />;
  }

  const series = query.data?.[0];
  if (!series) {
    return <ErrorState title="Série introuvable" description="Cette série n'a pas d'histoire à raconter, ou n'existe pas." />;
  }

  return (
    <div>
      <PageHeader
        title={series.name}
        description={`${series.unlockedCount}/${series.totalEntries} histoire(s) débloquée(s)`}
        actions={
          <Link href="/lore">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Retour
            </Button>
          </Link>
        }
      />
      <Stagger className="space-y-2">
        {series.entries.map((entry) => (
          <StaggerItem key={entry.id}>
            <LoreEntryCard entry={entry} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export default function LoreSeriesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <LoreSeriesContent />
      </AppShell>
    </RequireAuth>
  );
}
