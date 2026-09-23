"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Power, Sparkles, Swords, Trophy } from "lucide-react";
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

export default function AdminLiveOpsPage() {
  const [tab, setTab] = useState("announcement");

  return (
    <AdminShell>
      <PageHeader title="Live Ops" description="Annonce du site, événements XP, classement saisonnier et guerre de guildes." />
      <div className="mb-4 max-w-md">
        <Tabs
          tabs={[
            { id: "announcement", label: "Annonce" },
            { id: "events", label: "Événements" },
            { id: "seasons", label: "Saisons" },
            { id: "guild-wars", label: "Guerre de guildes" },
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
    </AdminShell>
  );
}
