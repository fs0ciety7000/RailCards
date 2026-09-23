"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Plus, Power, Sparkles, Swords, Trophy } from "lucide-react";
import { Badge, Button, Card, CardBody, FieldGroup, Input, Label, Skeleton, Tabs, Textarea, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";

function AnnouncementPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "announcement"], queryFn: adminApi.getAnnouncement });
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (query.data) {
      setMessage(query.data.message);
      setIsActive(query.data.isActive);
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: (input: { message: string; isActive: boolean }) => adminApi.upsertAnnouncement(input),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Annonce enregistrée" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "announcement"] });
      void queryClient.invalidateQueries({ queryKey: ["announcement"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-sky-300" aria-hidden="true" />
          <h2 className="font-semibold text-white">Bandeau d&apos;annonce</h2>
          {isActive && <Badge tone="success">Publiée</Badge>}
        </div>
        <p className="mb-3 text-xs text-white/50">Un message affiché sous la barre de navigation, sur toutes les pages, tant qu&apos;il est publié.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({ message, isActive });
          }}
        >
          <FieldGroup>
            <Label htmlFor="announcement-message">Message</Label>
            <Textarea id="announcement-message" rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 accent-[var(--color-rc-accent)]"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Publiée (visible par tous les joueurs)
            </label>
          </FieldGroup>
          <Button type="submit" className="mt-3" loading={saveMutation.isPending} disabled={!message.trim()}>
            Enregistrer
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function CreateEventForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [xpMultiplier, setXpMultiplier] = useState("2");

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createEvent({
        slug,
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        xpMultiplierBps: Math.round(Number(xpMultiplier) * 10_000),
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Événement publié" });
      setSlug("");
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setXpMultiplier("2");
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Publication impossible", description: getErrorMessage(err) }),
  });

  const valid = slug.trim() && title.trim() && description.trim() && startsAt && endsAt && Number(xpMultiplier) > 0;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          <h2 className="font-semibold text-white">Nouvel événement</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) createMutation.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <FieldGroup>
            <Label htmlFor="ev-slug">Slug</Label>
            <Input id="ev-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="weekend-double-xp" />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ev-title">Titre</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week-end Double XP" />
          </FieldGroup>
          <FieldGroup className="sm:col-span-2">
            <Label htmlFor="ev-description">Description</Label>
            <Textarea id="ev-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ev-startsAt">Début</Label>
            <Input id="ev-startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ev-endsAt">Fin</Label>
            <Input id="ev-endsAt" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="ev-multiplier">Multiplicateur XP (1 = normal, 2 = double)</Label>
            <Input id="ev-multiplier" type="number" min={0.1} step={0.1} value={xpMultiplier} onChange={(e) => setXpMultiplier(e.target.value)} />
          </FieldGroup>
          <div className="sm:col-span-2">
            <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={createMutation.isPending} disabled={!valid}>
              Publier l&apos;événement
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EventsList() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "events"], queryFn: adminApi.listEvents });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.updateEvent(id, { isActive }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Événement mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-white">Tous les événements</h2>
        <div className="space-y-2">
          {query.data?.map((ev) => {
            const now = Date.now();
            const inWindow = new Date(ev.startsAt).getTime() <= now && now <= new Date(ev.endsAt).getTime();
            const live = ev.isActive && inWindow;
            return (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3">
                <div>
                  <p className="font-display font-semibold text-white">
                    {ev.title} <span className="text-xs font-normal text-white/40">×{ev.xpMultiplierBps / 10_000} XP</span>
                  </p>
                  <p className="text-xs text-white/50">
                    {formatDateTime(ev.startsAt)} → {formatDateTime(ev.endsAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={live ? "success" : "neutral"}>{live ? "En direct" : ev.isActive ? "Programmé" : "Désactivé"}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power className="h-3.5 w-3.5" aria-hidden="true" />}
                    loading={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ id: ev.id, isActive: !ev.isActive })}
                  >
                    {ev.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </div>
            );
          })}
          {query.data?.length === 0 && <p className="text-sm text-white/50">Aucun événement créé pour l&apos;instant.</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function SeasonsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "seasons"], queryFn: adminApi.listSeasons });
  const [name, setName] = useState("");

  const startMutation = useMutation({
    mutationFn: () => adminApi.startSeason(name),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Nouvelle saison démarrée", description: "Le classement saisonnier a été réinitialisé." });
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "seasons"] });
      void queryClient.invalidateQueries({ queryKey: ["seasons"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  const active = query.data?.find((s) => s.status === "ACTIVE");

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          <h2 className="font-semibold text-white">Classement saisonnier</h2>
        </div>
        {active && (
          <p className="mb-3 text-sm text-white/70">
            Saison active : <span className="font-semibold text-white">{active.name}</span> (depuis {formatDateTime(active.startedAt)})
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) startMutation.mutate();
          }}
          className="flex flex-wrap gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la nouvelle saison" className="w-64" />
          <Button type="submit" loading={startMutation.isPending} disabled={!name.trim()}>
            {active ? "Réinitialiser (nouvelle saison)" : "Démarrer une saison"}
          </Button>
        </form>
        {query.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : (
          <div className="mt-4 space-y-1.5 text-sm">
            {query.data?.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-white/60">
                <span>{s.name}</span>
                <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status === "ACTIVE" ? "Active" : "Terminée"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function GuildWarsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "guild-wars"], queryFn: adminApi.listGuildWars });
  const [name, setName] = useState("");

  const startMutation = useMutation({
    mutationFn: () => adminApi.startGuildWar(name),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Nouvelle guerre démarrée", description: "Les récompenses ont été versées au top 3 et le classement a été réinitialisé." });
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "guild-wars"] });
      void queryClient.invalidateQueries({ queryKey: ["guild-wars"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  const active = query.data?.find((p) => p.status === "ACTIVE");

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <Swords className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          <h2 className="font-semibold text-white">Guerre de guildes</h2>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Classement inter-guildes basé sur l&apos;XP cumulé des membres. Démarrer une nouvelle guerre verse les récompenses CR au top 3 de la
          guerre en cours, puis remet tous les compteurs à zéro.
        </p>
        {active && (
          <p className="mb-3 text-sm text-white/70">
            Guerre active : <span className="font-semibold text-white">{active.name}</span> (depuis {formatDateTime(active.startedAt)})
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) startMutation.mutate();
          }}
          className="flex flex-wrap gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la nouvelle guerre" className="w-64" />
          <Button type="submit" loading={startMutation.isPending} disabled={!name.trim()}>
            {active ? "Réinitialiser (nouvelle guerre)" : "Démarrer une guerre"}
          </Button>
        </form>
        {query.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : (
          <div className="mt-4 space-y-1.5 text-sm">
            {query.data?.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-white/60">
                <span>{p.name}</span>
                <Badge tone={p.status === "ACTIVE" ? "success" : "neutral"}>{p.status === "ACTIVE" ? "Active" : "Terminée"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function EditTierForm({ tier, onDone }: { tier: import("@/lib/types").AdminSeasonPassTier; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pointsRequired, setPointsRequired] = useState(String(tier.pointsRequired));
  const [rewardCr, setRewardCr] = useState(String(tier.rewardCr));
  const [rewardXp, setRewardXp] = useState(String(tier.rewardXp));
  const [rewardLabel, setRewardLabel] = useState(tier.rewardLabel ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateSeasonPassTier(tier.id, {
        pointsRequired: Number(pointsRequired),
        rewardCr: Number(rewardCr),
        rewardXp: Number(rewardXp),
        rewardLabel: rewardLabel || undefined,
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Palier mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "season-pass"] });
      onDone();
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateMutation.mutate();
      }}
      className="grid gap-2 sm:grid-cols-4"
    >
      <Input type="number" min={0} value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} placeholder="Points requis" />
      <Input type="number" min={0} value={rewardCr} onChange={(e) => setRewardCr(e.target.value)} placeholder="Récompense CR" />
      <Input type="number" min={0} value={rewardXp} onChange={(e) => setRewardXp(e.target.value)} placeholder="Récompense XP" />
      <Input value={rewardLabel} onChange={(e) => setRewardLabel(e.target.value)} placeholder="Récompense cosmétique" />
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" size="sm" loading={updateMutation.isPending}>
          Enregistrer
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function SeasonPassPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "season-pass"], queryFn: adminApi.listSeasonPassTiers });
  const [tier, setTier] = useState("1");
  const [pointsRequired, setPointsRequired] = useState("");
  const [rewardCr, setRewardCr] = useState("");
  const [rewardXp, setRewardXp] = useState("");
  const [rewardLabel, setRewardLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createSeasonPassTier({
        tier: Number(tier),
        pointsRequired: Number(pointsRequired),
        rewardCr: rewardCr ? Number(rewardCr) : undefined,
        rewardXp: rewardXp ? Number(rewardXp) : undefined,
        rewardLabel: rewardLabel || undefined,
      }),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Palier créé" });
      setTier((n) => String(Number(n) + 1));
      setPointsRequired("");
      setRewardCr("");
      setRewardXp("");
      setRewardLabel("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "season-pass"] });
      void queryClient.invalidateQueries({ queryKey: ["season-pass"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  const valid = Number(tier) > 0 && pointsRequired !== "" && Number(pointsRequired) >= 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rc-accent" aria-hidden="true" />
            <h2 className="font-semibold text-white">Nouveau palier</h2>
          </div>
          {query.data?.season ? (
            <p className="mb-3 text-sm text-white/70">
              Saison active : <span className="font-semibold text-white">{query.data.season.name}</span>
            </p>
          ) : (
            <p className="mb-3 text-sm text-white/50">Aucune saison active — démarrez-en une dans l&apos;onglet Saisons pour ajouter des paliers.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) createMutation.mutate();
            }}
            className="grid gap-2 sm:grid-cols-5"
          >
            <Input type="number" min={1} value={tier} onChange={(e) => setTier(e.target.value)} placeholder="N° palier" />
            <Input type="number" min={0} value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} placeholder="Points requis" />
            <Input type="number" min={0} value={rewardCr} onChange={(e) => setRewardCr(e.target.value)} placeholder="Récompense CR" />
            <Input type="number" min={0} value={rewardXp} onChange={(e) => setRewardXp(e.target.value)} placeholder="Récompense XP" />
            <Input value={rewardLabel} onChange={(e) => setRewardLabel(e.target.value)} placeholder="Récompense cosmétique" />
            <div className="sm:col-span-5">
              <Button type="submit" icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={createMutation.isPending} disabled={!valid || !query.data?.season}>
                Ajouter le palier
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 font-semibold text-white">Paliers de la saison active</h2>
          {query.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-2">
              {query.data?.tiers.map((t) => (
                <div key={t.id} className="rounded-lg border border-white/10 p-3">
                  {editingId === t.id ? (
                    <EditTierForm tier={t} onDone={() => setEditingId(null)} />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold text-white">
                          Palier {t.tier} <span className="text-xs font-normal text-white/40">· {t.pointsRequired} pts</span>
                        </p>
                        <p className="text-xs text-white/50">
                          {t.rewardCr > 0 && `${t.rewardCr} CR `}
                          {t.rewardXp > 0 && `+${t.rewardXp} XP `}
                          {t.rewardLabel && `· ${t.rewardLabel}`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditingId(t.id)}>
                        Modifier
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {query.data?.tiers.length === 0 && <p className="text-sm text-white/50">Aucun palier créé pour l&apos;instant.</p>}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function AdminLiveOpsPage() {
  const [tab, setTab] = useState("announcement");

  return (
    <AdminShell>
      <PageHeader title="Live Ops" description="Annonce du site, événements XP, classement saisonnier, guerre de guildes et pass de saison." />
      <div className="mb-4 max-w-md">
        <Tabs
          tabs={[
            { id: "announcement", label: "Annonce" },
            { id: "events", label: "Événements" },
            { id: "seasons", label: "Saisons" },
            { id: "guild-wars", label: "Guerre de guildes" },
            { id: "season-pass", label: "Pass de saison" },
          ]}
          activeId={tab}
          onChange={setTab}
        />
      </div>
      {tab === "announcement" && <AnnouncementPanel />}
      {tab === "events" && (
        <div className="space-y-4">
          <CreateEventForm />
          <EventsList />
        </div>
      )}
      {tab === "seasons" && <SeasonsPanel />}
      {tab === "guild-wars" && <GuildWarsPanel />}
      {tab === "season-pass" && <SeasonPassPanel />}
    </AdminShell>
  );
}
