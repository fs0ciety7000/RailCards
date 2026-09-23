"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Button, Card, CardBody, EmptyState, ErrorState, Input, Skeleton, Tabs, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { friendsApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { Friend, FriendRequest } from "@/lib/types";

function AddFriendForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [debounced, setDebounced] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(username.trim().toLowerCase());
      setSuggestionsOpen(username.trim().length >= 2);
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const suggestionsQuery = useQuery({
    queryKey: ["users", "search", debounced],
    queryFn: () => usersApi.search(debounced),
    enabled: debounced.length >= 2,
  });
  const suggestions = suggestionsQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (target: string) => friendsApi.send(target),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Demande envoyée" });
      setUsername("");
      void queryClient.invalidateQueries({ queryKey: ["friends", "requests", "outgoing"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Envoi impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card className="mb-4">
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim()) sendMutation.mutate(username.trim());
          }}
          className="flex flex-wrap items-start gap-2"
        >
          <div className="relative flex-1">
            <Input
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setSuggestionsOpen(username.trim().length >= 2)}
              onBlur={() => setSuggestionsOpen(false)}
              placeholder="Pseudo du joueur…"
            />
            {suggestionsOpen && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rc-border bg-rc-surface shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.username}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setUsername(s.username);
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
          <Button type="submit" icon={<UserPlus className="h-4 w-4" aria-hidden="true" />} loading={sendMutation.isPending} disabled={!username.trim()}>
            Ajouter
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => friendsApi.remove(friend.friendshipId),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Ami retiré" });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-3">
        <Link href={`/profile/${friend.username}`}>
          <Avatar avatarUrl={friend.avatarUrl} displayName={friend.displayName} isAdmin={friend.role === "ADMIN"} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${friend.username}`} className="flex items-center gap-1.5 hover:underline">
            <p className="truncate font-semibold text-white">{friend.displayName}</p>
            {friend.role === "ADMIN" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />}
          </Link>
          <p className="truncate text-xs text-white/50">
            @{friend.username}
            {friend.friendSince && ` · amis depuis le ${formatDate(friend.friendSince)}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<UserMinus className="h-3.5 w-3.5" aria-hidden="true" />}
          loading={removeMutation.isPending}
          onClick={() => removeMutation.mutate()}
        >
          Retirer
        </Button>
      </CardBody>
    </Card>
  );
}

function RequestRow({ request, direction }: { request: FriendRequest; direction: "incoming" | "outgoing" }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: () => friendsApi.accept(request.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Demande acceptée" });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });
  const removeMutation = useMutation({
    mutationFn: () => friendsApi.declineOrCancel(request.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: direction === "incoming" ? "Demande refusée" : "Demande annulée" });
      void queryClient.invalidateQueries({ queryKey: ["friends", "requests"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-3">
        <Avatar avatarUrl={request.user.avatarUrl} displayName={request.user.displayName} isAdmin={request.user.role === "ADMIN"} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{request.user.displayName}</p>
          <p className="truncate text-xs text-white/50">@{request.user.username}</p>
        </div>
        {direction === "incoming" ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
              Accepter
            </Button>
            <Button size="sm" variant="danger" icon={<X className="h-3.5 w-3.5" aria-hidden="true" />} loading={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
              Refuser
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" loading={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
            Annuler
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function FriendsContent() {
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">("friends");
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: friendsApi.list });
  const incomingQuery = useQuery({ queryKey: ["friends", "requests", "incoming"], queryFn: () => friendsApi.requests("incoming") });
  const outgoingQuery = useQuery({ queryKey: ["friends", "requests", "outgoing"], queryFn: () => friendsApi.requests("outgoing") });

  const incomingCount = incomingQuery.data?.length ?? 0;

  return (
    <div>
      <PageHeader title="Amis" description="Gérez vos amis et vos demandes, distincts de vos guildes." />
      <AddFriendForm />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "friends", label: `Mes amis${friendsQuery.data?.length ? ` (${friendsQuery.data.length})` : ""}` },
            { id: "incoming", label: `Demandes reçues${incomingCount ? ` (${incomingCount})` : ""}` },
            { id: "outgoing", label: "Demandes envoyées" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as "friends" | "incoming" | "outgoing")}
        />
      </div>

      {tab === "friends" &&
        (friendsQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : friendsQuery.isError ? (
          <ErrorState description={getErrorMessage(friendsQuery.error)} />
        ) : friendsQuery.data!.length === 0 ? (
          <EmptyState icon={<Users />} title="Aucun ami pour l'instant" description="Cherchez un joueur ci-dessus pour lui envoyer une demande." />
        ) : (
          <Stagger className="space-y-2">
            {friendsQuery.data!.map((f) => (
              <StaggerItem key={f.friendshipId}>
                <FriendRow friend={f} />
              </StaggerItem>
            ))}
          </Stagger>
        ))}

      {tab === "incoming" &&
        (incomingQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : incomingQuery.data!.length === 0 ? (
          <EmptyState icon={<Users />} title="Aucune demande reçue" description="Les demandes d'ami reçues apparaîtront ici." />
        ) : (
          <Stagger className="space-y-2">
            {incomingQuery.data!.map((r) => (
              <StaggerItem key={r.id}>
                <RequestRow request={r} direction="incoming" />
              </StaggerItem>
            ))}
          </Stagger>
        ))}

      {tab === "outgoing" &&
        (outgoingQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : outgoingQuery.data!.length === 0 ? (
          <EmptyState icon={<Users />} title="Aucune demande envoyée" description="Vos demandes en attente apparaîtront ici." />
        ) : (
          <Stagger className="space-y-2">
            {outgoingQuery.data!.map((r) => (
              <StaggerItem key={r.id}>
                <RequestRow request={r} direction="outgoing" />
              </StaggerItem>
            ))}
          </Stagger>
        ))}

    </div>
  );
}

export default function FriendsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <FriendsContent />
      </AppShell>
    </RequireAuth>
  );
}
