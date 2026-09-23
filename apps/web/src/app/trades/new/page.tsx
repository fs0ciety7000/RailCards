"use client";

import { Suspense, useEffect, useState } from "react";
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
  CrAmount,
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
import { collectionApi, tradesApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { Avatar } from "@/components/Avatar";
import type { CardInstance } from "@/lib/types";

function CardPicker({
  items,
  selected,
  onToggle,
  loading,
  emptyMessage,
}: {
  items: CardInstance[];
  selected: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  emptyMessage: string;
}) {
  if (loading) return <Spinner />;
  if (items.length === 0) return <p className="text-sm text-white/50">{emptyMessage}</p>;
  return (
    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-rc-border p-2 sm:grid-cols-3">
      {items.map((instance) => {
        const isSelected = selected.includes(instance.id);
        return (
          <button
            type="button"
            key={instance.id}
            onClick={() => onToggle(instance.id)}
            aria-pressed={isSelected}
            className={`rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent ${
              isSelected ? "border-rc-accent bg-rc-accent/10" : "border-rc-border hover:border-white/25"
            }`}
          >
            <p className="truncate font-medium text-white">{instance.cardDefinition.name}</p>
            <RarityBadge label={instance.cardDefinition.rarity.label} colorHex={instance.cardDefinition.rarity.colorHex} size="sm" />
          </button>
        );
      })}
    </div>
  );
}

function OriginalTradeSummary({ tradeId }: { tradeId: string }) {
  const tradeQuery = useQuery({ queryKey: ["trades", tradeId], queryFn: () => tradesApi.getById(tradeId) });
  if (tradeQuery.isLoading || !tradeQuery.data) return null;

  const trade = tradeQuery.data;
  const offered = trade.items.filter((i) => i.side === "INITIATOR");
  const requested = trade.items.filter((i) => i.side === "RECIPIENT");

  return (
    <Card className="mx-auto mb-4 max-w-xl">
      <CardBody>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
          Contre-proposition à l&apos;échange de @{trade.initiator.username}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-white/50">Il/elle proposait</p>
            <TradeSummaryList items={offered} cr={trade.initiatorCr} />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/50">Il/elle demandait</p>
            <TradeSummaryList items={requested} cr={trade.recipientCr} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function TradeSummaryList({ items, cr }: { items: { id: string; cardInstance: CardInstance }[]; cr: number }) {
  if (items.length === 0 && cr === 0) return <p className="text-white/40">Rien</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <RarityBadge label={item.cardInstance.cardDefinition.name} colorHex={item.cardInstance.cardDefinition.rarity.colorHex} size="sm" />
        </li>
      ))}
      {cr > 0 && (
        <li>
          <Badge tone="accent">
            <CrAmount value={cr} />
          </Badge>
        </li>
      )}
    </ul>
  );
}

function NewTradeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("instanceId");
  const counterOf = searchParams.get("counterOf");
  const lockedRecipient = searchParams.get("recipientUsername") ?? "";
  const toast = useToast();
  const queryClient = useQueryClient();

  const [offered, setOffered] = useState<string[]>(preselected ? [preselected] : []);
  const [requested, setRequested] = useState<string[]>([]);
  const [debouncedRecipient, setDebouncedRecipient] = useState(lockedRecipient.toLowerCase());
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const inventoryQuery = useQuery({
    queryKey: ["collection", "available-for-trade"],
    queryFn: () => collectionApi.list({ state: "AVAILABLE", pageSize: 100 }),
  });

  const recipientCollectionQuery = useQuery({
    queryKey: ["users", "collection", debouncedRecipient],
    queryFn: () => usersApi.collection(debouncedRecipient, { pageSize: 100 }),
    enabled: debouncedRecipient.length >= 3,
    retry: false,
  });

  const recipientSuggestionsQuery = useQuery({
    queryKey: ["users", "search", debouncedRecipient],
    queryFn: () => usersApi.search(debouncedRecipient),
    enabled: !counterOf && debouncedRecipient.length >= 2,
  });
  const suggestions = recipientSuggestionsQuery.data ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTradeInput>({
    resolver: zodResolver(createTradeSchema),
    defaultValues: {
      recipientUsername: lockedRecipient,
      offeredCardInstanceIds: offered,
      requestedCardInstanceIds: requested,
    },
  });

  const recipientUsername = watch("recipientUsername");

  useEffect(() => {
    if (counterOf) {
      setDebouncedRecipient(lockedRecipient.toLowerCase());
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedRecipient(recipientUsername.trim().toLowerCase());
      setSuggestionsOpen(recipientUsername.trim().length >= 2);
    }, 400);
    return () => clearTimeout(timer);
  }, [recipientUsername, counterOf, lockedRecipient]);

  function selectRecipient(username: string) {
    setValue("recipientUsername", username, { shouldValidate: true });
    setDebouncedRecipient(username.toLowerCase());
    setSuggestionsOpen(false);
  }

  function toggleOffered(id: string) {
    setOffered((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("offeredCardInstanceIds", next, { shouldValidate: true });
      return next;
    });
  }

  function toggleRequested(id: string) {
    setRequested((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("requestedCardInstanceIds", next, { shouldValidate: true });
      return next;
    });
  }

  const submitMutation = useMutation({
    mutationFn: (values: CreateTradeInput) =>
      counterOf
        ? tradesApi.counter(counterOf, {
            offeredCardInstanceIds: offered,
            requestedCardInstanceIds: requested,
            initiatorCr: values.initiatorCr,
            recipientCr: values.recipientCr,
            message: values.message,
            expiresInHours: values.expiresInHours,
          })
        : tradesApi.create({ ...values, offeredCardInstanceIds: offered, requestedCardInstanceIds: requested }),
    onSuccess: () => {
      toast.show({ tone: "success", title: counterOf ? "Contre-proposition envoyée" : "Proposition d'échange envoyée" });
      void queryClient.invalidateQueries({ queryKey: ["collection"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      router.push("/trades");
    },
    onError: (err) => toast.show({ tone: "error", title: "Échange impossible", description: getErrorMessage(err) }),
  });

  const offeredItems = inventoryQuery.data?.items ?? [];
  const requestedItems = recipientCollectionQuery.data?.items ?? [];
  const showRecipientCollection = debouncedRecipient.length >= 3;

  return (
    <>
      {counterOf && <OriginalTradeSummary tradeId={counterOf} />}
      <Card className="mx-auto max-w-xl">
        <CardBody>
          <form onSubmit={handleSubmit((v) => submitMutation.mutate(v))} noValidate>
            <FieldGroup>
              <Label htmlFor="recipientUsername">Nom d&apos;utilisateur du destinataire</Label>
              <div className="relative">
                <Input
                  id="recipientUsername"
                  invalid={!!errors.recipientUsername}
                  disabled={!!counterOf}
                  autoComplete="off"
                  {...register("recipientUsername")}
                  onFocus={() => setSuggestionsOpen(recipientUsername.trim().length >= 2)}
                  onBlur={() => setSuggestionsOpen(false)}
                />
                {suggestionsOpen && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rc-border bg-rc-night-lighter shadow-lg">
                    {suggestions.map((s) => (
                      <li key={s.username}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectRecipient(s.username);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                        >
                          <Avatar avatarUrl={s.avatarUrl} displayName={s.displayName} isAdmin={false} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate text-white">{s.displayName}</span>
                            <span className="block truncate text-xs text-white/50">@{s.username}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <FieldError>{errors.recipientUsername?.message}</FieldError>
            </FieldGroup>

            <FieldGroup>
              <Label>Cartes que vous proposez</Label>
              <CardPicker
                items={offeredItems}
                selected={offered}
                onToggle={toggleOffered}
                loading={inventoryQuery.isLoading}
                emptyMessage="Aucune carte disponible dans votre collection."
              />
              <FieldError>{errors.offeredCardInstanceIds?.message as string | undefined}</FieldError>
            </FieldGroup>

            <FieldGroup>
              <Label>Cartes que vous demandez</Label>
              {showRecipientCollection ? (
                recipientCollectionQuery.isError ? (
                  <p className="text-sm text-white/50">Utilisateur introuvable.</p>
                ) : (
                  <CardPicker
                    items={requestedItems}
                    selected={requested}
                    onToggle={toggleRequested}
                    loading={recipientCollectionQuery.isLoading}
                    emptyMessage="Ce joueur n'a aucune carte disponible."
                  />
                )
              ) : (
                <p className="text-sm text-white/50">Renseignez un destinataire pour parcourir sa collection.</p>
              )}
              <FieldError>{errors.requestedCardInstanceIds?.message as string | undefined}</FieldError>
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

            <Button type="submit" fullWidth loading={isSubmitting || submitMutation.isPending}>
              {counterOf ? "Envoyer la contre-proposition" : "Envoyer la proposition"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}

function NewTradeContent() {
  const searchParams = useSearchParams();
  const isCounter = !!searchParams.get("counterOf");
  return (
    <div>
      <PageHeader
        title={isCounter ? "Contre-proposer" : "Proposer un échange"}
        description={
          isCounter
            ? "Ajustez les termes et envoyez votre contre-proposition."
            : "Sélectionnez un destinataire, vos cartes à offrir et celles que vous souhaitez recevoir."
        }
      />
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
