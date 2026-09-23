"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@railcards/ui";
import { CardFrame } from "@/components/CardTile";
import { parseCombatStats } from "@/components/CombatStatsPanel";
import { collectionApi } from "@/lib/api";

/**
 * Single-select grid of the player's own AVAILABLE cards that have combat
 * stats — the only cards eligible to represent them in a duel. Shared by
 * the challenge-creation form and the accept-a-challenge flow.
 */
export function CombatCardPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
}) {
  const query = useQuery({
    queryKey: ["collection", "combat-eligible"],
    queryFn: () => collectionApi.list({ state: "AVAILABLE", pageSize: 100 }),
  });

  if (query.isLoading) return <Spinner />;

  const eligible = (query.data?.items ?? []).filter((i) => i.cardDefinition.combatStatsEnabled);
  if (eligible.length === 0) {
    return (
      <p className="text-sm text-white/50">
        Aucune carte avec des statistiques de combat dans votre collection. Seules certaines cartes en sont dotées.
      </p>
    );
  }

  return (
    <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-rc-border p-2 sm:grid-cols-3">
      {eligible.map((instance) => {
        const stats = parseCombatStats(instance.cardDefinition.combatStats);
        const isSelected = selectedId === instance.id;
        return (
          <button
            type="button"
            key={instance.id}
            onClick={() => onSelect(instance.id)}
            aria-pressed={isSelected}
            className={`rounded-2xl p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent ${
              isSelected ? "bg-rc-accent/10 ring-2 ring-rc-accent" : "hover:bg-white/[0.04]"
            }`}
          >
            <CardFrame card={instance.cardDefinition} className="aspect-[3/4] w-full" />
            {stats && (
              <p className="mt-1 text-center text-[10px] text-white/50">
                P {stats.power} · F {stats.reliability} · C {stats.charm}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
