"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Badge, Button, Card, CardBody, CrAmount, EmptyState, ErrorState, RarityBadge, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { boostersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

function HistoryContent() {
  const [page, setPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: ["boosters", "history", page],
    queryFn: () => boostersApi.history({ page, pageSize: PAGE_SIZE }),
  });

  return (
    <div>
      <PageHeader title="Historique des boosters" description="Vos ouvertures passées." />

      {historyQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : historyQuery.isError ? (
        <ErrorState description={getErrorMessage(historyQuery.error)} action={<Button onClick={() => historyQuery.refetch()}>Réessayer</Button>} />
      ) : historyQuery.data!.items.length === 0 ? (
        <EmptyState
          icon={<Gift />}
          title="Aucun booster ouvert"
          description="Ouvrez votre premier booster pour commencer."
          action={
            <Link href="/boosters">
              <Button>Ouvrir un booster</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <Stagger className="space-y-3">
            {historyQuery.data!.items.map((opening) => (
              <StaggerItem key={opening.id}>
                <Card>
                  <CardBody>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold tracking-tight text-white">{opening.boosterDefinition?.name ?? "Booster"}</p>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{formatDateTime(opening.openedAt)}</span>
                        <Badge>
                          <CrAmount value={opening.pricePaidCr} />
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {opening.pulls.map((pull) => (
                        <RarityBadge key={pull.id} label={pull.cardDefinition.name} colorHex={pull.cardDefinition.rarity.colorHex} size="sm" />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="text-sm text-white/60">
              Page {page} / {Math.max(1, historyQuery.data!.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= historyQuery.data!.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoosterHistoryPage() {
  return (
    <RequireAuth>
      <AppShell>
        <HistoryContent />
      </AppShell>
    </RequireAuth>
  );
}
