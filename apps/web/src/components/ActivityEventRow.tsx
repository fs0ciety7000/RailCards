import { ArrowLeftRight, Award, BookOpen, Repeat, Sparkles, Swords, UserPlus } from "lucide-react";
import { Card, CardBody, CrAmount, RarityBadge } from "@railcards/ui";
import { formatDateTime } from "@/lib/format";
import type { GuildActivityEvent } from "@/lib/types";

const EVENT_ICON: Record<GuildActivityEvent["type"], typeof ArrowLeftRight> = {
  MARKET_SALE: ArrowLeftRight,
  TRADE_COMPLETED: Repeat,
  DUEL_RESOLVED: Swords,
  SERIES_COMPLETED: Award,
  RARE_PULL: Sparkles,
  GUILD_MEMBER_JOINED: UserPlus,
  QUEST_STEP_COMPLETED: BookOpen,
};

function EventLine({ event }: { event: GuildActivityEvent }) {
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
    case "GUILD_MEMBER_JOINED":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.member.username}</span> a rejoint la guilde
        </p>
      );
    case "QUEST_STEP_COMPLETED":
      return (
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">@{event.member.username}</span> a terminé l&apos;étape{" "}
          <span className="font-semibold text-white">{event.stepTitle}</span> de la quête {event.questTitle}
        </p>
      );
  }
}

export function ActivityEventRow({ event }: { event: GuildActivityEvent }) {
  const Icon = EVENT_ICON[event.type];
  return (
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
  );
}
