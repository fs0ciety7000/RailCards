"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, CardBody, CrAmount, EmptyState, ErrorState, Input, RarityBadge, Select, SkeletonGrid } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardArt } from "@/components/CardTile";
import { catalogApi, marketApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

const PAGE_SIZE = 20;

function MarketContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "recent">("recent");

  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });
  const listingsQuery = useQuery({
    queryKey: ["market", "listings", { page, search, rarity, sort }],
    queryFn: () =>
      marketApi.listings({ page, pageSize: PAGE_SIZE, search: search || undefined, rarity: rarity || undefined, sort }),
  });

  return (
    <div>
      <PageHeader title="Marché" description="Achetez et vendez des cartes entre joueurs." />

      <form
        className="mb-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
      >
        <Input
          aria-label="Rechercher une carte"
          placeholder="Rechercher une carte…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-56"
        />
        <Select
          aria-label="Filtrer par rareté"
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">Toutes les raretés</option>
          {raritiesQuery.data?.map((r) => (
            <option key={r.id} value={r.code}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Trier"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="recent">Plus récentes</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>

      {listingsQuery.isLoading ? (
        <SkeletonGrid count={10} />
      ) : listingsQuery.isError ? (
        <ErrorState description={getErrorMessage(listingsQuery.error)} action={<Button onClick={() => listingsQuery.refetch()}>Réessayer</Button>} />
      ) : listingsQuery.data!.items.length === 0 ? (
        <EmptyState icon="💱" title="Aucune annonce active" description="Revenez plus tard ou mettez une carte en vente." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {listingsQuery.data!.items.map((listing) => (
              <Link
                key={listing.id}
                href={`/market/${listing.id}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
              >
                <CardArt card={listing.cardInstance.cardDefinition} />
                <div className="mt-2 space-y-1">
                  <p className="truncate text-sm font-semibold text-white">{listing.cardInstance.cardDefinition.name}</p>
                  <RarityBadge
                    label={listing.cardInstance.cardDefinition.rarity.label}
                    colorHex={listing.cardInstance.cardDefinition.rarity.colorHex}
                    size="sm"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <CrAmount value={listing.priceCr} className="text-rc-accent" />
                    <span className="truncate text-white/40">@{listing.seller.username}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="text-sm text-white/60">
              Page {page} / {Math.max(1, listingsQuery.data!.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= listingsQuery.data!.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardBody className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/70">Une carte à vendre ? Retrouvez-la dans votre collection.</p>
          <Link href="/collection">
            <Button variant="outline" size="sm">
              Ma collection
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

export default function MarketPage() {
  return (
    <RequireAuth>
      <AppShell>
        <MarketContent />
      </AppShell>
    </RequireAuth>
  );
}
