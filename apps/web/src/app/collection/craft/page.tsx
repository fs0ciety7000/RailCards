"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Folder, Sparkles } from "lucide-react";
import { Button, Card, CardBody, EmptyState, ErrorState, RarityBadge, SkeletonGrid, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardTile } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { craftApi, catalogApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { Rarity } from "@/lib/types";

function nextRarity(rarities: Rarity[] | undefined, current: Rarity): Rarity | undefined {
  return rarities?.find((r) => r.order === current.order + 1);
}

function CraftContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const raritiesQuery = useQuery({ queryKey: ["rarities"], queryFn: catalogApi.rarities });
  const craftableQuery = useQuery({ queryKey: ["craft", "craftable"], queryFn: craftApi.craftable });

  const craftMutation = useMutation({
    mutationFn: (instanceIds: string[]) => craftApi.craft(instanceIds),
    onSuccess: (created) => {
      toast.show({
        tone: "success",
        title: "Fusion réussie",
        description: `Vous avez obtenu : ${created.cardDefinition.name} (${created.cardDefinition.rarity.label})`,
      });
      void queryClient.invalidateQueries({ queryKey: ["craft"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Fusion impossible", description: getErrorMessage(err) }),
  });

  return (
    <div>
      <PageHeader
        title="Fusion de doublons"
        description="Sacrifiez 3 exemplaires d'une même rareté pour obtenir 1 carte aléatoire de la rareté supérieure."
        actions={
          <Link href="/collection">
            <Button variant="outline" size="sm" icon={<Folder className="h-4 w-4" aria-hidden="true" />}>
              Retour à la collection
            </Button>
          </Link>
        }
      />

      {craftableQuery.isLoading ? (
        <SkeletonGrid count={6} />
      ) : craftableQuery.isError ? (
        <ErrorState description={getErrorMessage(craftableQuery.error)} action={<Button onClick={() => craftableQuery.refetch()}>Réessayer</Button>} />
      ) : craftableQuery.data!.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="Aucun doublon à fusionner"
          description="Il vous faut au moins 3 exemplaires disponibles d'une même carte (ou de cartes de même rareté) pour lancer une fusion."
        />
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {craftableQuery.data!.map((group) => {
            const target = nextRarity(raritiesQuery.data, group.cardDefinition.rarity);
            const isCrafting = craftMutation.isPending && craftMutation.variables === group.instanceIds;
            return (
              <StaggerItem key={group.cardDefinition.id}>
                <Card>
                  <CardBody className="flex flex-col gap-3">
                    <CardTile instanceId={group.instanceIds[0]!} card={group.cardDefinition} count={group.count} />
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <RarityBadge label={group.cardDefinition.rarity.label} colorHex={group.cardDefinition.rarity.colorHex} size="sm" />
                      {target && (
                        <>
                          <ArrowRight className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
                          <RarityBadge label={target.label} colorHex={target.colorHex} size="sm" />
                        </>
                      )}
                    </div>
                    <Button
                      fullWidth
                      size="sm"
                      icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                      loading={isCrafting}
                      disabled={craftMutation.isPending}
                      onClick={() => craftMutation.mutate(group.instanceIds)}
                    >
                      Fusionner 3 copies
                    </Button>
                  </CardBody>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

export default function CraftPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CraftContent />
      </AppShell>
    </RequireAuth>
  );
}
