"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, Package, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody, CrAmount, EmptyState, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { statsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function StatTile({ icon: Icon, label, children }: { icon: typeof TrendingUp; label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-accent/15 text-rc-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</p>
          <p className="truncate text-lg font-bold text-white">{children}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function TopPulledCardRow({
  card,
  rank,
}: {
  card: { cardDefinitionId: string; name: string; imageUrl: string; rarity: { label: string; colorHex: string }; pullCount: number };
  rank: number;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-2.5">
        <span className="w-5 shrink-0 text-center text-sm font-semibold text-white/40">{rank}</span>
        <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border" style={{ borderColor: card.rarity.colorHex }}>
          <Image src={card.imageUrl} alt={card.name} fill sizes="44px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{card.name}</p>
          <p className="truncate text-xs" style={{ color: card.rarity.colorHex }}>
            {card.rarity.label}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/70">×{card.pullCount}</span>
      </CardBody>
    </Card>
  );
}

function StatsContent() {
  const statsQuery = useQuery({ queryKey: ["stats", "me"], queryFn: statsApi.mine });

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (statsQuery.isError) {
    return <ErrorState title="Statistiques indisponibles" description={getErrorMessage(statsQuery.error)} />;
  }

  const stats = statsQuery.data!;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={TrendingUp} label="CR gagnés">
          <CrAmount value={stats.creditsEarned} />
        </StatTile>
        <StatTile icon={TrendingDown} label="CR dépensés">
          <CrAmount value={stats.creditsSpent} />
        </StatTile>
        <StatTile icon={Package} label="Boosters ouverts">
          {stats.totalBoostersOpened}
        </StatTile>
        <StatTile icon={CalendarDays} label="Jours actifs">
          {stats.activeDays}
        </StatTile>
      </div>
      <p className="mt-3 text-xs text-white/40">
        « Jours actifs » compte les jours distincts avec au moins une opération sur votre portefeuille — RailCards ne mesure pas la durée des
        sessions de jeu.
      </p>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-white">
          <BarChart3 className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          Cartes les plus tirées
        </h2>
        {stats.topPulledCards.length === 0 ? (
          <EmptyState icon={<Package />} title="Aucun tirage pour l'instant" description="Ouvrez un booster pour voir vos cartes préférées ici." />
        ) : (
          <Stagger className="space-y-2">
            {stats.topPulledCards.map((card, i) => (
              <StaggerItem key={card.cardDefinitionId}>
                <TopPulledCardRow card={card} rank={i + 1} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader title="Statistiques" description="Vos chiffres de collectionneur RailCards." />
        <StatsContent />
      </AppShell>
    </RequireAuth>
  );
}
