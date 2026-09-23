"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpCircle, Crown, LogOut, ShieldMinus, ShieldPlus, Sparkles, UserMinus, Users } from "lucide-react";
import { Badge, Button, Card, CardBody, ConfirmDialog, ErrorState, Skeleton, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { usersApi, guildsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import type { GuildMemberEntry, GuildRole } from "@/lib/types";

const ROLE_LABELS: Record<GuildRole, string> = { LEADER: "Chef", OFFICER: "Officier", MEMBER: "Membre" };

function MemberRow({
  member,
  viewerRole,
  viewerUserId,
  guildId,
}: {
  member: GuildMemberEntry;
  viewerRole: GuildRole | null;
  viewerUserId: string | undefined;
  guildId: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<"kick" | "transfer" | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["guilds"] });
  };

  const promoteMutation = useMutation({
    mutationFn: () => guildsApi.promote(guildId, member.userId),
    onSuccess: () => {
      toast.show({ tone: "success", title: `${member.displayName} est maintenant officier` });
      invalidate();
    },
    onError: (err) => toast.show({ tone: "error", title: "Action impossible", description: getErrorMessage(err) }),
  });
  const demoteMutation = useMutation({
    mutationFn: () => guildsApi.demote(guildId, member.userId),
    onSuccess: () => {
      toast.show({ tone: "success", title: `${member.displayName} n'est plus officier` });
      invalidate();
    },
    onError: (err) => toast.show({ tone: "error", title: "Action impossible", description: getErrorMessage(err) }),
  });
  const kickMutation = useMutation({
    mutationFn: () => guildsApi.kick(guildId, member.userId),
    onSuccess: () => {
      toast.show({ tone: "success", title: `${member.displayName} a été exclu` });
      setConfirmAction(null);
      invalidate();
    },
    onError: (err) => {
      setConfirmAction(null);
      toast.show({ tone: "error", title: "Exclusion impossible", description: getErrorMessage(err) });
    },
  });
  const transferMutation = useMutation({
    mutationFn: () => guildsApi.transferLeadership(guildId, member.userId),
    onSuccess: () => {
      toast.show({ tone: "success", title: `${member.displayName} est maintenant chef de guilde` });
      setConfirmAction(null);
      invalidate();
    },
    onError: (err) => {
      setConfirmAction(null);
      toast.show({ tone: "error", title: "Transfert impossible", description: getErrorMessage(err) });
    },
  });

  const isSelf = member.userId === viewerUserId;
  const canManage = !isSelf && member.role !== "LEADER" && (viewerRole === "LEADER" || (viewerRole === "OFFICER" && member.role === "MEMBER"));

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-3 py-3">
        <Avatar avatarUrl={member.avatarUrl} displayName={member.displayName} isAdmin={false} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-white">{member.displayName}</p>
            {member.role === "LEADER" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />}
          </div>
          <p className="truncate text-xs text-white/50">
            @{member.username} · {member.grade} · niveau {member.level}
          </p>
        </div>
        <Badge tone={member.role === "LEADER" ? "accent" : member.role === "OFFICER" ? "info" : "neutral"}>{ROLE_LABELS[member.role]}</Badge>
        <span className="flex shrink-0 items-center gap-1 text-xs text-white/50">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {member.xp} XP
        </span>

        {canManage && (
          <div className="flex w-full flex-wrap gap-1.5 pt-1">
            {viewerRole === "LEADER" && member.role === "MEMBER" && (
              <Button size="sm" variant="outline" icon={<ShieldPlus className="h-3.5 w-3.5" aria-hidden="true" />} loading={promoteMutation.isPending} onClick={() => promoteMutation.mutate()}>
                Promouvoir officier
              </Button>
            )}
            {viewerRole === "LEADER" && member.role === "OFFICER" && (
              <Button size="sm" variant="outline" icon={<ShieldMinus className="h-3.5 w-3.5" aria-hidden="true" />} loading={demoteMutation.isPending} onClick={() => demoteMutation.mutate()}>
                Rétrograder
              </Button>
            )}
            {viewerRole === "LEADER" && (
              <Button size="sm" variant="outline" icon={<ArrowUpCircle className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setConfirmAction("transfer")}>
                Transférer le leadership
              </Button>
            )}
            <Button size="sm" variant="danger" icon={<UserMinus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setConfirmAction("kick")}>
              Exclure
            </Button>
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirmAction === "kick"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => kickMutation.mutate()}
        loading={kickMutation.isPending}
        title="Exclure ce membre"
        description={`Retirer ${member.displayName} de la guilde ?`}
        confirmLabel="Exclure"
        destructive
      />
      <ConfirmDialog
        open={confirmAction === "transfer"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => transferMutation.mutate()}
        loading={transferMutation.isPending}
        title="Transférer le leadership"
        description={`${member.displayName} deviendra chef de la guilde et vous deviendrez officier.`}
        confirmLabel="Transférer"
      />
    </Card>
  );
}

function GuildDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const guildQuery = useQuery({ queryKey: ["guilds", "detail", params.id], queryFn: () => guildsApi.getById(params.id) });
  const mineQuery = useQuery({ queryKey: ["guilds", "mine"], queryFn: guildsApi.mine });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["guilds"] });
  };

  const joinMutation = useMutation({
    mutationFn: () => guildsApi.join(params.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Vous avez rejoint la guilde" });
      invalidate();
    },
    onError: (err) => toast.show({ tone: "error", title: "Impossible de rejoindre", description: getErrorMessage(err) }),
  });
  const leaveMutation = useMutation({
    mutationFn: () => guildsApi.leave(),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Vous avez quitté la guilde" });
      setLeaveOpen(false);
      invalidate();
      router.push("/guilds");
    },
    onError: (err) => {
      setLeaveOpen(false);
      toast.show({ tone: "error", title: "Impossible de quitter", description: getErrorMessage(err) });
    },
  });
  const disbandMutation = useMutation({
    mutationFn: () => guildsApi.disband(params.id),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Guilde dissoute" });
      setDisbandOpen(false);
      invalidate();
      router.push("/guilds");
    },
    onError: (err) => {
      setDisbandOpen(false);
      toast.show({ tone: "error", title: "Dissolution impossible", description: getErrorMessage(err) });
    },
  });

  if (guildQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (guildQuery.isError) {
    return (
      <ErrorState
        title="Guilde introuvable"
        description={getErrorMessage(guildQuery.error)}
        action={
          <Button variant="outline" onClick={() => router.push("/guilds")}>
            Retour aux guildes
          </Button>
        }
      />
    );
  }

  const guild = guildQuery.data!;
  const viewerMember = guild.members.find((m) => m.userId === meQuery.data?.id);
  const viewerRole = viewerMember?.role ?? null;
  const isMember = !!viewerMember;
  const isInAnotherGuild = !!mineQuery.data && mineQuery.data.id !== guild.id;

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </button>

      <Card>
        <CardBody className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rc-accent/15 text-lg font-bold text-rc-accent">
            {guild.tag}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold tracking-tight text-white">{guild.name}</h1>
            <p className="mt-0.5 text-sm text-white/60">
              Chef @{guild.leader.username} · fondée le {formatDate(guild.createdAt)}
            </p>
            {guild.description && <p className="mt-2 text-sm text-white/70">{guild.description}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-white/50">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {guild.memberCount} membre(s)
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isMember && !isInAnotherGuild && (
          <Button loading={joinMutation.isPending} onClick={() => joinMutation.mutate()}>
            Rejoindre la guilde
          </Button>
        )}
        {isMember && viewerRole !== "LEADER" && (
          <Button variant="outline" icon={<LogOut className="h-4 w-4" aria-hidden="true" />} onClick={() => setLeaveOpen(true)}>
            Quitter la guilde
          </Button>
        )}
        {isMember && viewerRole === "LEADER" && guild.memberCount === 1 && (
          <Button variant="danger" onClick={() => setDisbandOpen(true)}>
            Dissoudre la guilde
          </Button>
        )}
        {isMember && viewerRole === "LEADER" && guild.memberCount > 1 && (
          <Button variant="outline" icon={<LogOut className="h-4 w-4" aria-hidden="true" />} onClick={() => setLeaveOpen(true)}>
            Quitter (transférera le leadership)
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {guild.members.map((member) => (
          <MemberRow key={member.userId} member={member} viewerRole={viewerRole} viewerUserId={meQuery.data?.id} guildId={guild.id} />
        ))}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => leaveMutation.mutate()}
        loading={leaveMutation.isPending}
        title="Quitter la guilde"
        description={
          viewerRole === "LEADER"
            ? "Le leadership sera transféré au membre le plus ancien."
            : "Vous pourrez rejoindre une autre guilde ensuite."
        }
        confirmLabel="Quitter"
        destructive
      />
      <ConfirmDialog
        open={disbandOpen}
        onClose={() => setDisbandOpen(false)}
        onConfirm={() => disbandMutation.mutate()}
        loading={disbandMutation.isPending}
        title="Dissoudre la guilde"
        description="Cette action est définitive."
        confirmLabel="Dissoudre"
        destructive
      />
    </div>
  );
}

export default function GuildDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <GuildDetailContent />
      </AppShell>
    </RequireAuth>
  );
}
