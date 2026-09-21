"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, ErrorState, Skeleton } from "@railcards/ui";
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
    <div className="mx-auto max-w-md">
      <PageHeader title={isOwn ? "Mon profil" : profile.displayName} />
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-rc-accent text-3xl font-bold text-rc-night" aria-hidden="true">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-xl font-bold text-white">{profile.displayName}</p>
            <p className="text-sm text-white/50">@{profile.username}</p>
          </div>
          <div className="mt-2 grid w-full grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/5">
            <Stat label="Niveau" value={profile.level} />
            <Stat label="Cartes uniques" value={profile.uniqueCardCount} />
            <Stat label="Séries" value={profile.totalSeriesCount} />
          </div>
          <p className="mt-2 text-xs text-white/40">Membre depuis le {formatDate(profile.memberSince)}</p>
        </CardBody>
      </Card>

      {isOwn && meQuery.data && (
        <Card className="mt-4">
          <CardBody className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase text-white/40">Email</p>
              <p className="text-white">{meQuery.data.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-white/40">Portefeuille</p>
              <p className="text-white">{meQuery.data.walletBalance.toLocaleString("fr-BE")} CR</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-white/40">XP</p>
              <p className="text-white">{meQuery.data.xp}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-white/40">Série de récompenses</p>
              <p className="text-white">{meQuery.data.dailyRewardStreak} jour(s)</p>
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
      <p className="text-lg font-bold text-rc-accent">{value}</p>
      <p className="text-[11px] text-white/50">{label}</p>
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
