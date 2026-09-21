"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { RarityBadge } from "@railcards/ui";
import type { CardDefinition } from "@/lib/types";

export function CardArt({ card, className }: { card: CardDefinition; className?: string }) {
  return (
    <div className={className ?? "relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rc-border shadow-rc-sm"}>
      <Image
        src={card.imageUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 45vw, 220px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

export function CardTile({
  instanceId,
  card,
  state,
  href,
}: {
  instanceId: string;
  card: CardDefinition;
  state?: string;
  href?: string;
}) {
  const content = (
    <>
      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
        <CardArt
          card={card}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rc-border shadow-rc-sm transition-shadow duration-200 group-hover:border-rc-accent/40 group-hover:shadow-rc-md"
        />
      </motion.div>
      <div className="mt-2.5 space-y-1">
        <p className="truncate text-sm font-semibold text-white">{card.name}</p>
        <div className="flex items-center justify-between gap-1">
          <RarityBadge label={card.rarity.label} colorHex={card.rarity.colorHex} size="sm" />
          {state && state !== "AVAILABLE" && (
            <span className="truncate text-[10px] font-medium text-white/45">{stateLabel(state)}</span>
          )}
        </div>
      </div>
    </>
  );

  if (!href) {
    return <div>{content}</div>;
  }

  return (
    <Link
      href={href}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      aria-label={`${card.name}, ${card.rarity.label}${instanceId ? "" : ""}`}
    >
      {content}
    </Link>
  );
}

export function stateLabel(state: string): string {
  switch (state) {
    case "RESERVED_TRADE":
      return "Réservée (échange)";
    case "RESERVED_MARKET":
      return "En vente";
    case "ARCHIVED":
      return "Archivée";
    default:
      return state;
  }
}
