"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createListingSchema, type CreateListingInput } from "@railcards/contracts";
import { Button, Card, CardBody, EmptyState, FieldError, FieldGroup, Input, Label, Select, Spinner, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { collectionApi, marketApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function NewListingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("instanceId") ?? undefined;
  const toast = useToast();
  const queryClient = useQueryClient();

  const inventoryQuery = useQuery({
    queryKey: ["collection", "available-for-sale"],
    queryFn: () => collectionApi.list({ state: "AVAILABLE", pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues: { cardInstanceId: preselected, priceCr: 50 },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateListingInput) => marketApi.create(values),
    onSuccess: (listing) => {
      toast.show({ tone: "success", title: "Annonce publiée" });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["market"] });
      router.push(`/market/${listing.id}`);
    },
    onError: (err) => toast.show({ tone: "error", title: "Publication impossible", description: getErrorMessage(err) }),
  });

  if (inventoryQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const items = inventoryQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🗂️"
        title="Aucune carte disponible"
        description="Toutes vos cartes sont déjà réservées, ou vous n'en possédez pas encore."
      />
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardBody>
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} noValidate>
          <FieldGroup>
            <Label htmlFor="cardInstanceId">Carte à vendre</Label>
            <Select id="cardInstanceId" invalid={!!errors.cardInstanceId} {...register("cardInstanceId")}>
              <option value="">Sélectionnez une carte</option>
              {items.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.cardDefinition.name} · {instance.cardDefinition.rarity.label} (#{instance.serialNumber})
                </option>
              ))}
            </Select>
            <FieldError>{errors.cardInstanceId?.message}</FieldError>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="priceCr">Prix (CR)</Label>
            <Input id="priceCr" type="number" min={1} invalid={!!errors.priceCr} {...register("priceCr")} />
            <FieldError>{errors.priceCr?.message}</FieldError>
          </FieldGroup>
          <Button type="submit" fullWidth loading={isSubmitting || createMutation.isPending}>
            Publier l&apos;annonce
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function NewListingContent() {
  return (
    <div>
      <PageHeader title="Mettre une carte en vente" description="Choisissez une carte disponible et fixez son prix." />
      <Suspense fallback={<Spinner />}>
        <NewListingForm />
      </Suspense>
    </div>
  );
}

export default function NewListingPage() {
  return (
    <RequireAuth>
      <AppShell>
        <NewListingContent />
      </AppShell>
    </RequireAuth>
  );
}
