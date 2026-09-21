"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTradeSchema, type CreateTradeInput } from "@railcards/contracts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  FieldError,
  FieldGroup,
  Input,
  Label,
  RarityBadge,
  Spinner,
  useToast,
} from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { collectionApi, tradesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function NewTradeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("instanceId");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [offered, setOffered] = useState<string[]>(preselected ? [preselected] : []);

  const inventoryQuery = useQuery({
    queryKey: ["collection", "available-for-trade"],
    queryFn: () => collectionApi.list({ state: "AVAILABLE", pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTradeInput>({
    resolver: zodResolver(createTradeSchema),
    defaultValues: { recipientUsername: "", offeredCardInstanceIds: offered, requestedCardInstanceIds: [] },
  });

  function toggleOffered(id: string) {
    setOffered((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("offeredCardInstanceIds", next, { shouldValidate: true });
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: CreateTradeInput) =>
      tradesApi.create({ ...values, offeredCardInstanceIds: offered, requestedCardInstanceIds: [] }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Proposition d'échange envoyée" });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      router.push("/trades");
    },
    onError: (err) => toast.show({ tone: "error", title: "Échange impossible", description: getErrorMessage(err) }),
  });

  const items = inventoryQuery.data?.items ?? [];

  return (
    <Card className="mx-auto max-w-xl">
      <CardBody>
        <form
          onSubmit={handleSubmit((v) => createMutation.mutate(v))}
          noValidate
        >
          <FieldGroup>
            <Label htmlFor="recipientUsername">Nom d&apos;utilisateur du destinataire</Label>
            <Input id="recipientUsername" invalid={!!errors.recipientUsername} {...register("recipientUsername")} />
            <FieldError>{errors.recipientUsername?.message}</FieldError>
          </FieldGroup>

          <FieldGroup>
            <Label>Cartes que vous proposez</Label>
            {inventoryQuery.isLoading ? (
              <Spinner />
            ) : items.length === 0 ? (
              <p className="text-sm text-white/50">Aucune carte disponible dans votre collection.</p>
            ) : (
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-white/10 p-2 sm:grid-cols-3">
                {items.map((instance) => {
                  const selected = offered.includes(instance.id);
                  return (
                    <button
                      type="button"
                      key={instance.id}
                      onClick={() => toggleOffered(instance.id)}
                      aria-pressed={selected}
                      className={`rounded-lg border p-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent ${
                        selected ? "border-rc-accent bg-rc-accent/10" : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <p className="truncate font-medium text-white">{instance.cardDefinition.name}</p>
                      <RarityBadge label={instance.cardDefinition.rarity.label} colorHex={instance.cardDefinition.rarity.colorHex} size="sm" />
                    </button>
                  );
                })}
              </div>
            )}
            <FieldError>{errors.offeredCardInstanceIds?.message as string | undefined}</FieldError>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="initiatorCr">CR que vous ajoutez à l&apos;offre (optionnel)</Label>
            <Input id="initiatorCr" type="number" min={0} {...register("initiatorCr")} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="recipientCr">CR demandés en retour (optionnel)</Label>
            <Input id="recipientCr" type="number" min={0} {...register("recipientCr")} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="message">Message (optionnel)</Label>
            <Input id="message" {...register("message")} />
          </FieldGroup>

          <Badge tone="info" className="mb-4 block w-fit">
            Astuce : demander des cartes précises à l&apos;autre joueur n&apos;est pas encore possible — seuls
            l&apos;offre de cartes et un montant en CR sont pris en charge pour le moment.
          </Badge>

          <Button type="submit" fullWidth loading={isSubmitting || createMutation.isPending}>
            Envoyer la proposition
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function NewTradeContent() {
  return (
    <div>
      <PageHeader title="Proposer un échange" description="Sélectionnez un destinataire et vos cartes à offrir." />
      <Suspense fallback={<Spinner />}>
        <NewTradeForm />
      </Suspense>
    </div>
  );
}

export default function NewTradePage() {
  return (
    <RequireAuth>
      <AppShell>
        <NewTradeContent />
      </AppShell>
    </RequireAuth>
  );
}
