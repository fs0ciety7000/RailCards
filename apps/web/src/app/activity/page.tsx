"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Award, Radio, Repeat, Sparkles, Swords } from "lucide-react";
import { Card, CardBody, CrAmount, EmptyState, ErrorState, RarityBadge, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { activityApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

const EVENT_ICON: Record<ActivityEvent["type"], typeof ArrowLeftRight> = {
  MARKET_SALE: ArrowLeftRight,
  TRADE_COMPLETED: Repeat,
  DUEL_RESOLVED: Swords,
  SERIES_COMPLETED: Award,
  RARE_PULL: Sparkles,
};

function EventLine({ event }: { event: ActivityEvent }) {
  switch (event.type) {
    case "MARKET_SALE":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.buyer.username}</span> a acheté{" "}
          <RarityBadge label={event.cardName} colorHex={event.rarity.colorHex} size="sm" /> à{" "}
          <span className="font-semibold text-white">@{event.seller.username}</span> pour <CrAmount value={event.priceCr} />
        </p>
      );
    case "TRADE_COMPLETED":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.initiator.username}</span> et{" "}
          <span className="font-semibold text-white">@{event.recipient.username}</span> ont finalisé un échange
        </p>
      );
    case "DUEL_RESOLVED":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.winner.username}</span> a battu{" "}
          <span className="font-semibold text-white">@{event.loser.username}</span> en duel et remporté <CrAmount value={event.wagerCr} />
        </p>
      );
    case "SERIES_COMPLETED":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.player.username}</span> a complété la série{" "}
          <span className="font-semibold text-white">{event.seriesName}</span>
        </p>
      );
    case "RARE_PULL":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.player.username}</span> a tiré{" "}
          <RarityBadge label={event.cardName} colorHex={event.rarity.colorHex} size="sm" /> d&apos;un booster
        </p>
      );
  }
}

function ActivityContent() {
  const feedQuery = useQuery({ queryKey: ["activity"], queryFn: () => activityApi.feed(50), refetchInterval: 30_000 });

  return (
    <div>
      <PageHeader title="Fil d'activité" description="Les derniers faits marquants du réseau, en temps réel." />

      {feedQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : feedQuery.isError ? (
        <ErrorState description={getErrorMessage(feedQuery.error)} />
      ) : feedQuery.data!.length === 0 ? (
        <EmptyState icon={<Radio />} title="Rien à signaler" description="Le réseau est calme pour l'instant." />
      ) : (
        <Stagger className="space-y-2">
          {feedQuery.data!.map((event, i) => {
            const Icon = EVENT_ICON[event.type];
            return (
              <StaggerItem key={i}>
                <Card>
                  <CardBody className="flex items-center gap-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                      <Icon className="h-4 w-4 text-rc-accent" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <EventLine event={event} />
                      <p className="mt-0.5 text-xs text-white/40">{formatDateTime(event.occurredAt)}</p>
                    </div>
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

export default function ActivityPage() {
  return (
    <RequireAuth>
      <AppShell>
        <ActivityContent />
      </AppShell>
    </RequireAuth>
  );
}
