"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Heart, RotateCcw, ShieldCheck, Swords, Trophy, Zap } from "lucide-react";
import { Badge, Card, CardBody, CrAmount, ErrorState, RarityBadge, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { duelsApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { DUEL_STAT_LABELS, DUEL_STATUS_LABELS, formatDateTime } from "@/lib/format";
import type { CardInstance, Duel, DuelStat } from "@/lib/types";

const STAT_ICON: Record<DuelStat, typeof Zap> = { POWER: Zap, RELIABILITY: ShieldCheck, CHARM: Heart };

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "danger" | "info"> = {
  PENDING: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

function DuelantTile({ card, label, isWinner, isDraw }: { card: CardInstance; label: string; isWinner: boolean; isDraw: boolean }) {
  const def = card.cardDefinition;
  return (
    <div className="flex-1">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border shadow-rc-md transition-shadow"
        style={{
          borderColor: isWinner ? "#facc15" : "rgba(255,255,255,0.12)",
          boxShadow: isWinner ? "0 0 28px -6px #facc15a0" : undefined,
        }}
      >
        <Image src={def.imageUrl} alt="" fill sizes="240px" className="object-cover" unoptimized />
        {isWinner && (
          <div className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-black shadow">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        )}
        {!isWinner && !isDraw && <div className="absolute inset-0 bg-black/45" aria-hidden="true" />}
      </div>
      <p className="mt-2 truncate text-center text-sm font-semibold text-white">{def.name}</p>
      <div className="mt-1 flex justify-center">
        <RarityBadge label={def.rarity.label} colorHex={def.rarity.colorHex} size="sm" />
      </div>
    </div>
  );
}

function StatRace({ duel, replayKey }: { duel: Duel; replayKey: number }) {
  if (!duel.stat || duel.challengerValue === null || duel.opponentValue === null) return null;
  const Icon = STAT_ICON[duel.stat];
  const max = Math.max(duel.challengerValue, duel.opponentValue, 1);
  const isDraw = duel.winnerId === null;

  return (
    <Card className="mt-4">
      <CardBody>
        <p className="mb-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-white/80">
          <Icon className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          Statistique tirée au sort : {DUEL_STAT_LABELS[duel.stat] ?? duel.stat}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-white/60">
              <span>{duel.challenger.username}</span>
              <span className="font-bold text-white">{duel.challengerValue}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                key={`challenger-${replayKey}`}
                className="h-full rounded-full bg-gradient-to-r from-sky-400/70 to-sky-400"
                initial={{ width: 0 }}
                animate={{ width: `${(duel.challengerValue / max) * 100}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-white/60">
              <span>{duel.opponent.username}</span>
              <span className="font-bold text-white">{duel.opponentValue}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                key={`opponent-${replayKey}`}
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400/70 to-fuchsia-400"
                initial={{ width: 0 }}
                animate={{ width: `${(duel.opponentValue / max) * 100}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
        <motion.p
          key={`verdict-${replayKey}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.4 }}
          className={`mt-4 text-center font-semibold ${isDraw ? "text-white/60" : "text-amber-300"}`}
        >
          {isDraw ? (
            "Égalité — mise remboursée, personne ne gagne."
          ) : (
            <>
              {duel.winner?.displayName} l&apos;emporte — <CrAmount value={duel.wagerCr} /> remportés
            </>
          )}
        </motion.p>
      </CardBody>
    </Card>
  );
}

function DuelReplayContent({ id }: { id: string }) {
  const router = useRouter();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const duelQuery = useQuery({ queryKey: ["duels", "detail", id], queryFn: () => duelsApi.getById(id) });
  const [replayKey, setReplayKey] = useState(0);

  if (duelQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (duelQuery.isError) {
    return <ErrorState description={getErrorMessage(duelQuery.error)} />;
  }

  const duel = duelQuery.data!;
  const resolved = duel.status === "ACCEPTED" && duel.opponentCardInstance && duel.stat;
  const isDraw = duel.winnerId === null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
          <Swords className="h-5 w-5 text-rc-accent" aria-hidden="true" />
          @{duel.challenger.username} vs @{duel.opponent.username}
        </h1>
        <Badge tone={STATUS_TONE[duel.status] ?? "neutral"}>{DUEL_STATUS_LABELS[duel.status] ?? duel.status}</Badge>
      </div>
      <p className="mb-4 text-xs text-white/40">
        {formatDateTime(duel.createdAt)}
        {duel.respondedAt && ` · résolu le ${formatDateTime(duel.respondedAt)}`}
      </p>

      {duel.message && <p className="mb-4 rounded-lg bg-white/5 p-3 text-sm italic text-white/70">&laquo; {duel.message} &raquo;</p>}

      <div className="flex items-start gap-3">
        <DuelantTile
          card={duel.challengerCardInstance}
          label="Challenger"
          isWinner={!!resolved && duel.winnerId === duel.challengerId}
          isDraw={isDraw}
        />
        <div className="mt-16 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
          VS
        </div>
        {duel.opponentCardInstance ? (
          <DuelantTile
            card={duel.opponentCardInstance}
            label="Adversaire"
            isWinner={!!resolved && duel.winnerId === duel.opponentId}
            isDraw={isDraw}
          />
        ) : (
          <div className="flex-1 pt-8 text-center text-sm text-white/40">En attente d&apos;une réponse…</div>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center">
        <Badge tone="accent">
          Mise : <CrAmount value={duel.wagerCr} />
        </Badge>
      </p>

      {resolved && <StatRace duel={duel} replayKey={replayKey} />}

      {resolved && (
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Revoir le duel
        </button>
      )}

      {meQuery.data && duel.challenger.username !== meQuery.data.username && duel.opponent.username !== meQuery.data.username && (
        <p className="mt-4 text-center text-xs text-white/30">Vous n&apos;êtes pas participant à ce duel.</p>
      )}
    </motion.div>
  );
}

export default function DuelReplayPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <DuelReplayContent id={params.id} />
      </AppShell>
    </RequireAuth>
  );
}
