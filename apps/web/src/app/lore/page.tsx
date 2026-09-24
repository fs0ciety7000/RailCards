"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookMarked } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, ProgressBar, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { loreApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { CARD_CATEGORY_LABELS } from "@/lib/format";

function LoreContent() {
  const bookQuery = useQuery({ queryKey: ["lore"], queryFn: () => loreApi.book() });

  return (
    <div>
      <PageHeader title="Livre de lore" description="L'histoire de chaque carte, à débloquer en les collectionnant." />

      {bookQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : bookQuery.isError ? (
        <ErrorState description={getErrorMessage(bookQuery.error)} action={<Button onClick={() => bookQuery.refetch()}>Réessayer</Button>} />
      ) : bookQuery.data!.length === 0 ? (
        <EmptyState icon={<BookMarked />} title="Aucune histoire à découvrir pour l'instant" />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {bookQuery.data!.map((s) => (
            <StaggerItem key={s.seriesId}>
              <Link href={`/lore/${s.seriesId}`} className="block">
                <Card className="transition-colors hover:bg-white/[0.04]">
                  <CardBody className="flex gap-3">
                    {s.coverImageUrl && (
                      <img src={s.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-rc-border object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate font-semibold tracking-tight text-white">{s.name}</p>
                        {s.unlockedCount >= s.totalEntries ? (
                          <Badge tone="success">Complet</Badge>
                        ) : (
                          <span className="shrink-0 text-xs font-bold text-rc-accent">
                            {s.unlockedCount}/{s.totalEntries}
                          </span>
                        )}
                      </div>
                      <p className="mb-3 text-xs text-white/50">{CARD_CATEGORY_LABELS[s.category] ?? s.category}</p>
                      <ProgressBar value={s.unlockedCount} max={s.totalEntries} />
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

export default function LorePage() {
  return (
    <RequireAuth>
      <AppShell>
        <LoreContent />
      </AppShell>
    </RequireAuth>
  );
}
