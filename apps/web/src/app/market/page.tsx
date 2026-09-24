"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Gavel } from "lucide-react";
import { Badge, Button, Card, CardBody, CrAmount, EmptyState, ErrorState, Input, RarityBadge, Select, SkeletonGrid } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardArt } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { catalogApi, marketApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatTimeLeft } from "@/lib/format";
import type { MarketListingType } from "@/lib/types";

const PAGE_SIZE = 20;

function MarketContent() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  // Seeds from ?search= (e.g. the global command palette jumping to a
  // specific card) — read once on mount, then purely local state, same as
  // every other filter on this page.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [rarity, setRarity] = useState("");
  const [listingType, setListingType] = useState<MarketListingType | "">("");
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "recent">("recent");

  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });
  const listingsQuery = useQuery({
    queryKey: ["market", "listings", { page, search, rarity, listingType, sort }],
    queryFn: () =>
      marketApi.listings({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        rarity: rarity || undefined,
        listingType: listingType || undefined,
        sort,
      }),
    refetchInterval: 20_000,
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
          aria-label="Filtrer par type de vente"
          value={listingType}
          onChange={(e) => {
            setListingType(e.target.value as MarketListingType | "");
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">Prix fixe et enchères</option>
          <option value="FIXED">Prix fixe</option>
          <option value="AUCTION">Enchères</option>
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
        <EmptyState icon={<ArrowLeftRight />} title="Aucune annonce active" description="Revenez plus tard ou mettez une carte en vente." />
      ) : (
        <>
          <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {listingsQuery.data!.items.map((listing) => (
              <StaggerItem key={listing.id}>
                <Link
                  href={`/market/${listing.id}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
                >
                  <CardArt card={listing.cardInstance.cardDefinition} className="relative aspect-[3/4] w-full" />
                  <div className="mt-2.5 space-y-1">
                    <p className="font-display truncate text-sm font-semibold text-white">{listing.cardInstance.cardDefinition.name}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <RarityBadge
                        label={listing.cardInstance.cardDefinition.rarity.label}
                        colorHex={listing.cardInstance.cardDefinition.rarity.colorHex}
                        size="sm"
                      />
                      {listing.listingType === "AUCTION" && (
                        <Badge tone="accent" className="flex items-center gap-1">
                          <Gavel className="h-2.5 w-2.5" aria-hidden="true" />
                          Enchère
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <CrAmount
                        value={listing.listingType === "AUCTION" ? (listing.currentBidCr ?? listing.priceCr) : listing.priceCr}
                        className="text-rc-accent"
                      />
                      <span className="truncate text-white/40">@{listing.seller.username}</span>
                    </div>
                    {listing.listingType === "AUCTION" && listing.auctionEndsAt && (
                      <p className="text-[11px] text-white/40">{formatTimeLeft(listing.auctionEndsAt)}</p>
                    )}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
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
        <Suspense fallback={null}>
          <MarketContent />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
