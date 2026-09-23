"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, Spinner, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { CombatCardPicker } from "@/components/CombatCardPicker";
import { duelsApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function NewDuelForm() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [cardInstanceId, setCardInstanceId] = useState<string | null>(null);
  const [opponentUsername, setOpponentUsername] = useState("");
  const [debouncedOpponent, setDebouncedOpponent] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [wagerCr, setWagerCr] = useState("50");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOpponent(opponentUsername.trim().toLowerCase());
      setSuggestionsOpen(opponentUsername.trim().length >= 2);
    }, 400);
    return () => clearTimeout(timer);
  }, [opponentUsername]);

  const suggestionsQuery = useQuery({
    queryKey: ["users", "search", debouncedOpponent],
    queryFn: () => usersApi.search(debouncedOpponent),
    enabled: debouncedOpponent.length >= 2,
  });
  const suggestions = suggestionsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      duelsApi.create({
        opponentUsername,
        cardInstanceId: cardInstanceId!,
        wagerCr: Number(wagerCr),
        message: message || undefined,
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Défi envoyé" });
      void queryClient.invalidateQueries({ queryKey: ["duels"] });
      router.push("/duels");
    },
    onError: (err) => toast.show({ tone: "error", title: "Défi impossible", description: getErrorMessage(err) }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!cardInstanceId) {
      setFormError("Choisissez une carte à engager dans le duel.");
      return;
    }
    if (!opponentUsername.trim()) {
      setFormError("Indiquez le pseudo de votre adversaire.");
      return;
    }
    const wager = Number(wagerCr);
    if (!Number.isInteger(wager) || wager < 1) {
      setFormError("La mise doit être un nombre entier d'au moins 1 CR.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardBody>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Label>Votre carte engagée</Label>
            <CombatCardPicker selectedId={cardInstanceId} onSelect={setCardInstanceId} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="opponentUsername">Adversaire</Label>
            <div className="relative">
              <Input
                id="opponentUsername"
                autoComplete="off"
                value={opponentUsername}
                onChange={(e) => setOpponentUsername(e.target.value)}
                onFocus={() => setSuggestionsOpen(opponentUsername.trim().length >= 2)}
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
                          setOpponentUsername(s.username);
                          setSuggestionsOpen(false);
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
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="wagerCr">Mise (CR)</Label>
            <Input id="wagerCr" type="number" min={1} value={wagerCr} onChange={(e) => setWagerCr(e.target.value)} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="message">Message (optionnel)</Label>
            <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} />
          </FieldGroup>

          <FieldError>{formError ?? undefined}</FieldError>

          <Button type="submit" fullWidth icon={<Swords className="h-4 w-4" aria-hidden="true" />} loading={createMutation.isPending}>
            Lancer le défi
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function NewDuelContent() {
  return (
    <div>
      <PageHeader
        title="Nouveau duel"
        description="Choisissez une carte, un adversaire et une mise en CR. Une statistique est tirée au sort à l'acceptation."
      />
      <Suspense fallback={<Spinner />}>
        <NewDuelForm />
      </Suspense>
    </div>
  );
}

export default function NewDuelPage() {
  return (
    <RequireAuth>
      <AppShell>
        <NewDuelContent />
      </AppShell>
    </RequireAuth>
  );
}
