"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Sparkles, X } from "lucide-react";
import { announcementApi, eventsApi } from "@/lib/api";
import { formatTimeLeft } from "@/lib/format";

function useDismissed(key: string) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      // ignore — banner just stays visible
    }
  }, [key]);
  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // best-effort only
    }
  }
  return { dismissed, dismiss };
}

function AnnouncementBanner() {
  const query = useQuery({ queryKey: ["announcement", "active"], queryFn: announcementApi.active, refetchInterval: 60_000 });
  const announcement = query.data;
  const { dismissed, dismiss } = useDismissed(announcement ? `announcement-dismissed-${announcement.updatedAt}` : "announcement-dismissed-none");

  if (!announcement || dismissed) return null;

  return (
    <div className="border-b border-sky-500/25 bg-sky-500/10 px-4 py-2 sm:ml-60">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 text-sm">
        <Megaphone className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
        <p className="flex-1 text-sky-100">{announcement.message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer l'annonce"
          className="shrink-0 rounded-full p-1 text-sky-300/70 hover:bg-white/[0.08] hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function EventBanner() {
  const query = useQuery({ queryKey: ["events", "active"], queryFn: eventsApi.active, refetchInterval: 60_000 });
  const event = query.data;
  const { dismissed, dismiss } = useDismissed(event ? `event-dismissed-${event.id}` : "event-dismissed-none");

  if (!event || dismissed) return null;
  const isDoubleXp = event.xpMultiplierBps !== 10_000;
  const multiplier = event.xpMultiplierBps / 10_000;

  return (
    <div className="border-b border-rc-accent/25 bg-rc-accent/10 px-4 py-2 sm:ml-60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-rc-accent" aria-hidden="true" />
        <p className="flex-1 text-rc-accent-light">
          <span className="font-semibold">{event.title}</span>
          {isDoubleXp && (
            <span className="ml-2 rounded-full bg-rc-accent/20 px-2 py-0.5 text-xs font-bold text-rc-accent">×{multiplier} XP</span>
          )}
        </p>
        <span className="shrink-0 text-xs text-rc-accent-light/70">Se termine dans {formatTimeLeft(event.endsAt)}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer l'événement"
          className="shrink-0 rounded-full p-1 text-rc-accent/70 hover:bg-white/[0.08] hover:text-rc-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Site-wide notices shown just under the navbar: an admin text announcement and/or the current live-ops event. Either, both, or neither can be visible at once. */
export function LiveBanners() {
  return (
    <>
      <AnnouncementBanner />
      <EventBanner />
    </>
  );
}
