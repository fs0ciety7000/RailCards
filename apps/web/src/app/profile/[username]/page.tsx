"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Mail, Wallet, Sparkles, Flame } from "lucide-react";
import { Badge, Card, CardBody, ErrorState, ProgressBar, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";

function ProfileContent() {
  const params = useParams<{ username: string }>();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const profileQuery = useQuery({
    queryKey: ["users", "profile", params.username],
    queryFn: () => usersApi.publicProfile(params.username),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return <ErrorState title="Profil introuvable" description={getErrorMessage(profileQuery.error)} />;
  }

  const profile = profileQuery.data!;
  const isOwn = meQuery.data?.username === profile.username;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-md flex-col justify-center">
      <PageHeader title={isOwn ? "Mon profil" : profile.displayName} />
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-rc-accent text-3xl font-bold text-rc-night shadow-rc-glow"
            aria-hidden="true"
          >
            {profile.displayName.slice(0, 1).toUpperCase()}
          </motion.span>
          <div>
            <p className="text-xl font-bold tracking-tight text-white">{profile.displayName}</p>
            <p className="text-sm text-white/50">@{profile.username}</p>
          </div>
          <Badge tone="accent">{profile.grade}</Badge>
          <div className="mt-2 grid w-full grid-cols-3 divide-x divide-rc-border rounded-xl border border-rc-border bg-white/[0.03]">
            <Stat label="Niveau" value={profile.level} />
            <Stat label="Cartes uniques" value={profile.uniqueCardCount} />
            <Stat label="Séries" value={profile.totalSeriesCount} />
          </div>
          <p className="mt-2 text-xs text-white/40">Membre depuis le {formatDate(profile.memberSince)}</p>
        </CardBody>
      </Card>

      {isOwn && meQuery.data && (
        <Card className="mt-4">
          <CardBody>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoField icon={Mail} label="Email" value={meQuery.data.email} />
              <InfoField icon={Wallet} label="Portefeuille" value={`${meQuery.data.walletBalance.toLocaleString("fr-BE")} CR`} />
              <InfoField icon={Sparkles} label="XP total" value={String(meQuery.data.xp)} />
              <InfoField icon={Flame} label="Série de récompenses" value={`${meQuery.data.dailyRewardStreak} jour(s)`} />
            </div>
            <div className="mt-4">
              <ProgressBar
                value={meQuery.data.xpProgress.xpIntoLevel}
                max={meQuery.data.xpProgress.xpForNextLevel}
                label={`Progression vers le niveau ${meQuery.data.level + 1}`}
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3">
      <p className="text-lg font-bold tracking-tight text-rc-accent">{value}</p>
      <p className="text-[11px] text-white/50">{label}</p>
    </div>
  );
}

function InfoField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</p>
        <p className="truncate text-white">{value}</p>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  return (
    <RequireAuth>
      <AppShell>
        <ProfileContent />
      </AppShell>
    </RequireAuth>
  );
}
