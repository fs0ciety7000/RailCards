"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button, EmptyState, ErrorState, Input, Skeleton, useToast } from "@railcards/ui";
import { Avatar } from "@/components/Avatar";
import { guildsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { GuildMessage } from "@/lib/types";

function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function GuildChat({ guildId, viewerUsername }: { guildId: string; viewerUsername: string | undefined }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["guilds", "messages", guildId],
    queryFn: () => guildsApi.messages(guildId, 50),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messagesQuery.data]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => guildsApi.postMessage(guildId, body),
    onSuccess: (message) => {
      setDraft("");
      queryClient.setQueryData<GuildMessage[]>(["guilds", "messages", guildId], (old) =>
        old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
      );
    },
    onError: (err) => toast.show({ tone: "error", title: "Message non envoyé", description: getErrorMessage(err) }),
  });

  if (messagesQuery.isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }
  if (messagesQuery.isError) {
    return <ErrorState description={getErrorMessage(messagesQuery.error)} />;
  }

  const messages = messagesQuery.data ?? [];

  return (
    <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-rc-border">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <EmptyState title="Aucun message" description="Soyez le premier à écrire dans le salon de la guilde." />
        ) : (
          messages.map((m) => {
            const mine = m.author.username === viewerUsername;
            return (
              <div key={m.id} className={"flex items-start gap-2 " + (mine ? "flex-row-reverse text-right" : "")}>
                <Avatar avatarUrl={m.author.avatarUrl} displayName={m.author.displayName} isAdmin={false} size={28} />
                <div className={"max-w-[75%] rounded-2xl px-3 py-1.5 text-sm " + (mine ? "bg-rc-accent/20 text-white" : "bg-white/[0.06] text-white/90")}>
                  {!mine && <p className="text-xs font-semibold text-rc-accent">{m.author.displayName}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 text-[10px] text-white/35">{formatMessageTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="flex items-center gap-2 border-t border-rc-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) sendMutation.mutate(trimmed);
        }}
      >
        <Input
          aria-label="Écrire un message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" size="sm" icon={<Send className="h-4 w-4" aria-hidden="true" />} loading={sendMutation.isPending} disabled={!draft.trim()}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
