"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Sparkles } from "lucide-react";
import { Button, Card, CardBody, EmptyState, ErrorState, RarityBadge, SkeletonGrid, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardTile } from "@/components/CardTile";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { cardVariantsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function FoilContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const foilableQuery = useQuery({ queryKey: ["card-variants", "foilable"], queryFn: cardVariantsApi.foilable });

  const foilifyMutation = useMutation({
    mutationFn: (instanceIds: string[]) => cardVariantsApi.foilify(instanceIds),
    onSuccess: (result) => {
      toast.show({
        tone: "success",
        title: "Carte devenue foil",
        description: `${result.cardDefinition.name} brille maintenant dans votre collection.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["card-variants"] });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de faire briller cette carte", description: getErrorMessage(err) }),
  });

  return (
    <div>
      <PageHeader
        title="Variantes foil"
        description="Sacrifiez 3 exemplaires d'une même carte pour en rendre 1 holographique — un effet visuel exclusif, sans changement de rareté ni de statistiques."
        actions={
          <Link href="/collection">
            <Button variant="outline" size="sm" icon={<Folder className="h-4 w-4" aria-hidden="true" />}>
              Retour à la collection
            </Button>
          </Link>
        }
      />

      {foilableQuery.isLoading ? (
        <SkeletonGrid count={6} />
      ) : foilableQuery.isError ? (
        <ErrorState description={getErrorMessage(foilableQuery.error)} action={<Button onClick={() => foilableQuery.refetch()}>Réessayer</Button>} />
      ) : foilableQuery.data!.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="Aucun doublon à faire briller"
          description="Il vous faut au moins 3 exemplaires disponibles et non-foil d'une même carte pour en obtenir une variante holographique."
        />
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {foilableQuery.data!.map((group) => {
            const isFoiling = foilifyMutation.isPending && foilifyMutation.variables === group.instanceIds;
            return (
              <StaggerItem key={group.cardDefinition.id}>
                <Card>
                  <CardBody className="flex flex-col gap-3">
                    <CardTile instanceId={group.instanceIds[0]!} card={group.cardDefinition} count={group.count} />
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <RarityBadge label={group.cardDefinition.rarity.label} colorHex={group.cardDefinition.rarity.colorHex} size="sm" />
                    </div>
                    <Button
                      fullWidth
                      size="sm"
                      icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                      loading={isFoiling}
                      disabled={foilifyMutation.isPending}
                      onClick={() => foilifyMutation.mutate(group.instanceIds)}
                    >
                      Faire briller 3 copies
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

export default function FoilPage() {
  return (
    <RequireAuth>
      <AppShell>
        <FoilContent />
      </AppShell>
    </RequireAuth>
  );
}
