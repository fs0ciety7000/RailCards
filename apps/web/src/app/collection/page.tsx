"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Folder, Gem, LayoutGrid, ListChecks, Rows3, Sparkles } from "lucide-react";
import { Button, EmptyState, ErrorState, Select, SkeletonGrid } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardTile, CardListRow } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { catalogApi, collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

const PAGE_SIZE = 24;
const VIEW_STORAGE_KEY = "railcards.collection.view";
type ViewMode = "grid" | "list";

function CollectionContent() {
  const [page, setPage] = useState(1);
  const [seriesId, setSeriesId] = useState("");
  const [rarity, setRarity] = useState("");
  const [state, setState] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "grid" || stored === "list") setView(stored);
    } catch {
      // ignore (private mode / blocked storage) — default grid view stands
    }
  }, []);

  function changeView(v: ViewMode) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // per-viewer convenience only — a failed write just means it resets next visit
    }
  }

  const seriesQuery = useQuery({ queryKey: ["series"], queryFn: catalogApi.series });
  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });
  const collectionQuery = useQuery({
    queryKey: ["collection", { page, seriesId, rarity, state }],
    queryFn: () =>
      collectionApi.list({
        page,
        pageSize: PAGE_SIZE,
        seriesId: seriesId || undefined,
        rarity: rarity || undefined,
        state: state || undefined,
      }),
  });

  function resetPage() {
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Ma collection"
        description={
          collectionQuery.data ? `${collectionQuery.data.total} carte(s) au total` : "Vos cartes collectionnées"
        }
        actions={
          <div className="flex gap-2">
            <Link href="/collection/craft">
              <Button variant="outline" size="sm" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
                Fusion
              </Button>
            </Link>
            <Link href="/collection/foil">
              <Button variant="outline" size="sm" icon={<Gem className="h-4 w-4" aria-hidden="true" />}>
                Variantes foil
              </Button>
            </Link>
            <Link href="/collection/album">
              <Button variant="outline" size="sm" icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}>
                Vue album
              </Button>
            </Link>
            <Link href="/collection/missing">
              <Button variant="outline" size="sm" icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
                Cartes manquantes
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Select
          aria-label="Filtrer par série"
          value={seriesId}
          onChange={(e) => {
            setSeriesId(e.target.value);
            resetPage();
          }}
          className="w-auto"
        >
          <option value="">Toutes les séries</option>
          {seriesQuery.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par rareté"
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value);
            resetPage();
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
          aria-label="Filtrer par état"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            resetPage();
          }}
          className="w-auto"
        >
          <option value="">Tous les états</option>
          <option value="AVAILABLE">Disponible</option>
          <option value="RESERVED_TRADE">Réservée (échange)</option>
          <option value="RESERVED_MARKET">En vente</option>
          <option value="ARCHIVED">Archivée</option>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-rc-border bg-rc-night-light p-1" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            onClick={() => changeView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Vue grille"
            className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-rc-accent text-rc-night" : "text-white/50 hover:text-white"}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changeView("list")}
            aria-pressed={view === "list"}
            aria-label="Vue liste"
            className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-rc-accent text-rc-night" : "text-white/50 hover:text-white"}`}
          >
            <Rows3 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {collectionQuery.isLoading ? (
        <SkeletonGrid count={12} />
      ) : collectionQuery.isError ? (
        <ErrorState description={getErrorMessage(collectionQuery.error)} action={<Button onClick={() => collectionQuery.refetch()}>Réessayer</Button>} />
      ) : collectionQuery.data!.items.length === 0 ? (
        <EmptyState
          icon={<Folder />}
          title="Aucune carte pour l'instant"
          description="Ouvrez un booster pour commencer votre collection."
          action={
            <Link href="/boosters">
              <Button>Ouvrir un booster</Button>
            </Link>
          }
        />
      ) : view === "grid" ? (
        <>
          <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {collectionQuery.data!.items.map((instance) => (
              <StaggerItem key={instance.id}>
                <CardTile
                  instanceId={instance.id}
                  card={instance.cardDefinition}
                  state={instance.state}
                  href={`/collection/${instance.id}`}
                  count={instance.count}
                  foil={instance.isFoil}
                  signature={instance.isSignature ? { number: instance.signatureNumber!, edition: instance.signatureEdition! } : null}
                />
              </StaggerItem>
            ))}
          </Stagger>
          <Pagination page={page} total={collectionQuery.data!.total} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      ) : (
        <>
          <Stagger className="flex flex-col gap-2">
            {collectionQuery.data!.items.map((instance) => (
              <StaggerItem key={instance.id}>
                <CardListRow
                  card={instance.cardDefinition}
                  state={instance.state}
                  href={`/collection/${instance.id}`}
                  count={instance.count}
                  foil={instance.isFoil}
                  signature={instance.isSignature ? { number: instance.signatureNumber!, edition: instance.signatureEdition! } : null}
                />
              </StaggerItem>
            ))}
          </Stagger>
          <Pagination page={page} total={collectionQuery.data!.total} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Précédent
      </Button>
      <span className="text-sm text-white/60">
        Page {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Suivant
      </Button>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CollectionContent />
      </AppShell>
    </RequireAuth>
  );
}
