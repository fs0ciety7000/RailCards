"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardBody, ErrorState, RarityBadge, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { collectionApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { ACQUISITION_LABELS, formatDateTime } from "@/lib/format";
import { stateLabel } from "@/components/CardTile";

function CardDetailContent() {
  const params = useParams<{ instanceId: string }>();
  const router = useRouter();
  const instanceId = params.instanceId;

  const detailQuery = useQuery({
    queryKey: ["collection", "detail", instanceId],
    queryFn: () => collectionApi.detail(instanceId),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg">
        <Skeleton className="aspect-[3/4] w-full" />
        <Skeleton className="mt-4 h-6 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Carte introuvable"
        description={getErrorMessage(detailQuery.error)}
        action={
          <Button variant="outline" onClick={() => router.back()}>
            Retour
          </Button>
        }
      />
    );
  }

  const instance = detailQuery.data!;
  const card = instance.cardDefinition;
  const canAct = instance.isOwnedByRequester && instance.state === "AVAILABLE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-lg"
    >
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </button>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rc-border shadow-rc-md">
        <Image src={card.imageUrl} alt="" fill sizes="512px" className="object-cover" unoptimized priority />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RarityBadge label={card.rarity.label} colorHex={card.rarity.colorHex} />
        <Badge>{card.series.name}</Badge>
        {!instance.isOwnedByRequester && <Badge tone="info">Appartient à @{instance.owner.username}</Badge>}
        {instance.isOwnedByRequester && instance.state !== "AVAILABLE" && (
          <Badge tone="danger">{stateLabel(instance.state)}</Badge>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{card.name}</h1>
      <p className="mt-2 text-sm text-white/70">{card.description}</p>
      {card.flavorText && <p className="mt-2 text-sm italic text-white/50">&laquo; {card.flavorText} &raquo;</p>}

      <Card className="mt-4">
        <CardBody className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-white/40">Numéro de série</p>
            <p className="text-white">#{instance.serialNumber}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-white/40">Obtenue via</p>
            <p className="text-white">{ACQUISITION_LABELS[instance.acquiredVia] ?? instance.acquiredVia}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold uppercase text-white/40">Acquise le</p>
            <p className="text-white">{formatDateTime(instance.acquiredAt)}</p>
          </div>
        </CardBody>
      </Card>

      {canAct && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href={`/market/new?instanceId=${instance.id}`} className="flex-1">
            <Button fullWidth>Mettre en vente</Button>
          </Link>
          <Link href={`/trades/new?instanceId=${instance.id}`} className="flex-1">
            <Button variant="secondary" fullWidth>
              Proposer en échange
            </Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export default function CardDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CardDetailContent />
      </AppShell>
    </RequireAuth>
  );
}
