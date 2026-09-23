"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Mail, Wallet, Sparkles, Flame, Camera, Crown, Flag, Lock, Unlock, Pencil, ShieldCheck, Star, X } from "lucide-react";
import { changePasswordSchema, type ChangePasswordInput } from "@railcards/contracts";
import { Badge, Button, Card, CardBody, Dialog, EmptyState, ErrorState, FieldError, FieldGroup, Input, Label, ProgressBar, Skeleton, Textarea, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { CardArt } from "@/components/CardTile";
import { ApiError, authApi, collectionApi, profileBannersApi, usersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/lib/auth-store";
import type { CardDefinition, ProfileBanner } from "@/lib/types";

const MAX_FAVORITES = 5;

const AVATAR_ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const BIO_MAX_LENGTH = 280;

function AvatarUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const me = await usersApi.uploadAvatar(file);
      onUploaded(me.avatarUrl ?? "");
      toast.show({ tone: "success", title: "Avatar mis à jour" });
    } catch (err) {
      toast.show({ tone: "error", title: "Échec de l'upload", description: getErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-full border border-rc-border bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        {uploading ? "Envoi…" : "Changer l'avatar"}
      </button>
      <input ref={fileInputRef} type="file" accept={AVATAR_ACCEPTED_TYPES} className="hidden" onChange={handleFile} />
    </>
  );
}

function BioSection({ bio, isOwn, username }: { bio: string | null; isOwn: boolean; username: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio ?? "");

  const updateBioMutation = useMutation({
    mutationFn: (value: string) => usersApi.updateMe({ bio: value }),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile", username] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (!isOwn) {
    if (!bio) return null;
    return <p className="mt-3 max-w-sm text-sm text-white/70">{bio}</p>;
  }

  if (editing) {
    return (
      <div className="mt-3 w-full max-w-sm text-left">
        <Textarea
          value={draft}
          maxLength={BIO_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Quelques mots sur vous…"
          rows={3}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-white/40">
            {draft.length}/{BIO_MAX_LENGTH}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(bio ?? "");
                setEditing(false);
              }}
            >
              Annuler
            </Button>
            <Button size="sm" loading={updateBioMutation.isPending} onClick={() => updateBioMutation.mutate(draft)}>
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(bio ?? "");
        setEditing(true);
      }}
      className="mt-3 flex max-w-sm items-start gap-1.5 text-left text-sm text-white/70 hover:text-white"
    >
      <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-white/40" aria-hidden="true" />
      {bio || <span className="text-white/40 italic">Ajouter une bio…</span>}
    </button>
  );
}

function ChangePasswordForm() {
  const toast = useToast();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      const res = await authApi.changePassword(values);
      setSession(res.accessToken, res.user);
      reset();
      toast.show({ tone: "success", title: "Mot de passe modifié", description: "Vos autres sessions ont été déconnectées." });
    } catch (err) {
      toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) });
    }
  }

  return (
    <Card className="mt-4">
      <CardBody>
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-white/50" aria-hidden="true" />
          Sécurité
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3">
          <FieldGroup className="mb-0">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" invalid={!!errors.currentPassword} {...register("currentPassword")} />
            <FieldError>{errors.currentPassword?.message}</FieldError>
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <Input id="newPassword" type="password" autoComplete="new-password" invalid={!!errors.newPassword} {...register("newPassword")} />
            <FieldError>{errors.newPassword?.message}</FieldError>
          </FieldGroup>
          <Button type="submit" loading={isSubmitting} className="justify-self-start">
            Changer le mot de passe
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function FavoritesPickerDialog({ open, onClose, favoriteIds }: { open: boolean; onClose: () => void; favoriteIds: string[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useParams<{ username: string }>();
  const ownedQuery = useQuery({
    queryKey: ["collection", "favorites-picker"],
    queryFn: () => collectionApi.list({ pageSize: 100 }),
    enabled: open,
  });

  const ownedCards = useMemo(() => {
    const seen = new Map<string, CardDefinition>();
    for (const item of ownedQuery.data?.items ?? []) {
      if (!seen.has(item.cardDefinition.id)) seen.set(item.cardDefinition.id, item.cardDefinition);
    }
    return [...seen.values()];
  }, [ownedQuery.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    void queryClient.invalidateQueries({ queryKey: ["users", "profile", params.username] });
  }

  const addMutation = useMutation({
    mutationFn: (cardDefinitionId: string) => usersApi.addFavorite(cardDefinitionId),
    onSuccess: invalidate,
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });
  const removeMutation = useMutation({
    mutationFn: (cardDefinitionId: string) => usersApi.removeFavorite(cardDefinitionId),
    onSuccess: invalidate,
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  const atCap = favoriteIds.length >= MAX_FAVORITES;
  const pending = addMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} title="Gérer mes cartes favorites" description={`${favoriteIds.length}/${MAX_FAVORITES} sélectionnées`} className="max-w-lg">
      {ownedQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : ownedCards.length === 0 ? (
        <EmptyState title="Aucune carte" description="Ouvrez un booster pour obtenir des cartes à mettre en favori." />
      ) : (
        <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
          {ownedCards.map((card) => {
            const isFavorite = favoriteIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={pending || (!isFavorite && atCap)}
                onClick={() => (isFavorite ? removeMutation.mutate(card.id) : addMutation.mutate(card.id))}
                className="group relative rounded-2xl text-left disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CardArt card={card} className="relative aspect-[3/4] w-full" />
                <span
                  className={`pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                    isFavorite ? "border-amber-400/60 bg-amber-400/90 text-rc-night" : "border-white/20 bg-black/70 text-white/70"
                  }`}
                >
                  <Star className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

function FavoritesSection({
  favoriteCards,
  isOwn,
}: {
  favoriteCards: CardDefinition[];
  isOwn: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useParams<{ username: string }>();
  const [pickerOpen, setPickerOpen] = useState(false);

  const removeMutation = useMutation({
    mutationFn: (cardDefinitionId: string) => usersApi.removeFavorite(cardDefinitionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile", params.username] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (!isOwn && favoriteCards.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-semibold text-white">
            <Star className="h-4 w-4 text-amber-400" fill="currentColor" aria-hidden="true" />
            Cartes favorites
          </h2>
          {isOwn && (
            <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
              Gérer
            </Button>
          )}
        </div>
        {favoriteCards.length === 0 ? (
          <p className="text-sm text-white/40 italic">
            {isOwn ? "Choisissez jusqu'à 5 cartes à mettre en avant." : "Aucune carte favorite pour l'instant."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {favoriteCards.map((card) => (
              <div key={card.id} className="group relative">
                <CardArt card={card} className="relative aspect-[3/4] w-full" />
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(card.id)}
                    disabled={removeMutation.isPending}
                    aria-label={`Retirer ${card.name} des favoris`}
                    className="absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/70 opacity-0 backdrop-blur-sm transition-opacity hover:text-white group-hover:opacity-100 disabled:opacity-40 sm:group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
      {isOwn && <FavoritesPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} favoriteIds={favoriteCards.map((c) => c.id)} />}
    </Card>
  );
}

function BannerSwatch({ banner, selected, onClick, loading }: { banner: ProfileBanner; selected: boolean; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-rc-accent bg-rc-accent/10" : "border-rc-border hover:border-white/30"
      }`}
    >
      <span
        className="h-6 w-10 shrink-0 rounded-md"
        style={{ background: `linear-gradient(135deg, ${banner.colorFrom}, ${banner.colorTo})` }}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate font-medium text-white">{banner.name}</span>
    </button>
  );
}

function BannersSection({ isOwn }: { isOwn: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useParams<{ username: string }>();
  const minePreQuery = useQuery({ queryKey: ["profile-banners", "mine"], queryFn: profileBannersApi.mine, enabled: isOwn });

  const setActiveMutation = useMutation({
    mutationFn: (bannerId: string | null) => profileBannersApi.setActive(bannerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile-banners", "mine"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile", params.username] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (!isOwn) return null;
  if (minePreQuery.isLoading) return <Skeleton className="mt-4 h-24 w-full" />;
  const unlocked = minePreQuery.data?.unlocked ?? [];
  if (unlocked.length === 0) return null;

  const activeId = minePreQuery.data?.active?.id ?? null;

  return (
    <Card className="mt-4">
      <CardBody>
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-white">
          <Flag className="h-4 w-4 text-rc-accent" aria-hidden="true" />
          Bannières débloquées
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {unlocked.map((banner) => (
            <BannerSwatch
              key={banner.id}
              banner={banner}
              selected={banner.id === activeId}
              loading={setActiveMutation.isPending}
              onClick={() => setActiveMutation.mutate(banner.id)}
            />
          ))}
        </div>
        {activeId && (
          <Button size="sm" variant="ghost" className="mt-3" disabled={setActiveMutation.isPending} onClick={() => setActiveMutation.mutate(null)}>
            Retirer la bannière active
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function ProfileContent() {
  const params = useParams<{ username: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });
  const profileQuery = useQuery({
    queryKey: ["users", "profile", params.username],
    queryFn: () => usersApi.publicProfile(params.username),
  });

  const updateMeMutation = useMutation({
    mutationFn: (input: { isPublic: boolean }) => usersApi.updateMe(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile", params.username] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (profileQuery.isError) {
    const isPrivate = profileQuery.error instanceof ApiError && profileQuery.error.statusCode === 403;
    return (
      <ErrorState
        title={isPrivate ? "Profil privé" : "Profil introuvable"}
        description={isPrivate ? "Ce joueur a choisi de masquer son profil." : getErrorMessage(profileQuery.error)}
      />
    );
  }

  const profile = profileQuery.data!;
  const isOwn = meQuery.data?.username === profile.username;
  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-md flex-col justify-center">
      <PageHeader title={isOwn ? "Mon profil" : profile.displayName} />
      <Card className="overflow-hidden">
        {profile.activeBanner && (
          <div
            className="h-16 w-full"
            style={{ background: `linear-gradient(135deg, ${profile.activeBanner.colorFrom}, ${profile.activeBanner.colorTo})` }}
            aria-hidden="true"
          />
        )}
        <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} isAdmin={isAdmin} />
          </motion.div>
          {isOwn && (
            <AvatarUploadButton
              onUploaded={() => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
                void queryClient.invalidateQueries({ queryKey: ["users", "profile", params.username] });
              }}
            />
          )}
          <div>
            <p className="text-xl font-bold tracking-tight text-white">{profile.displayName}</p>
            <p className="text-sm text-white/50">@{profile.username}</p>
          </div>
          <BioSection bio={profile.bio} isOwn={isOwn} username={profile.username} />
          <div className="flex items-center gap-2">
            <Badge tone="accent">{profile.grade}</Badge>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-tight text-amber-300">
                <Crown className="h-3 w-3" aria-hidden="true" />
                Administrateur
              </span>
            )}
          </div>
          <div className="mt-2 grid w-full grid-cols-3 divide-x divide-rc-border rounded-xl border border-rc-border bg-white/[0.03]">
            <Stat label="Niveau" value={profile.level} />
            <Stat label="Cartes uniques" value={profile.uniqueCardCount} />
            <Stat label="Séries" value={profile.totalSeriesCount} />
          </div>
          <p className="mt-2 text-xs text-white/40">Membre depuis le {formatDate(profile.memberSince)}</p>
          {isOwn && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={profile.isPublic ? <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
              loading={updateMeMutation.isPending}
              onClick={() => updateMeMutation.mutate({ isPublic: !profile.isPublic })}
            >
              {profile.isPublic ? "Profil public — visible par les autres joueurs" : "Profil masqué — visible par vous seul"}
            </Button>
          )}
        </CardBody>
      </Card>

      <FavoritesSection favoriteCards={profile.favoriteCards} isOwn={isOwn} />
      <BannersSection isOwn={isOwn} />

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

      {isOwn && <ChangePasswordForm />}
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
