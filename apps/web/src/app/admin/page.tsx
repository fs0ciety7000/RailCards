"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gem, BookOpen, Gift, Mail, Users, Flag, ScrollText } from "lucide-react";
import { Card, CardBody } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { adminApi } from "@/lib/api";

const TILES = [
  { href: "/admin/cards", label: "Cartes", icon: Gem, desc: "Créer, publier et archiver des cartes" },
  { href: "/admin/series", label: "Séries", icon: BookOpen, desc: "Gérer les séries de collection" },
  { href: "/admin/boosters", label: "Boosters", icon: Gift, desc: "Définitions et pools de tirage" },
  { href: "/admin/invitations", label: "Invitations", icon: Mail, desc: "Générer des codes d'invitation" },
  { href: "/admin/users", label: "Utilisateurs", icon: Users, desc: "Suspendre / réactiver des comptes" },
  { href: "/admin/reports", label: "Signalements", icon: Flag, desc: "Modération des signalements" },
  { href: "/admin/ledger", label: "Registres", icon: ScrollText, desc: "Transactions & journal d'audit" },
] as const;

function AdminOverview() {
  const usersQuery = useQuery({ queryKey: ["admin", "users", "count"], queryFn: () => adminApi.listUsers({ pageSize: 1 }) });
  const reportsQuery = useQuery({ queryKey: ["admin", "reports", "open"], queryFn: () => adminApi.listReports({ status: "OPEN", pageSize: 1 }) });
  const invitationsQuery = useQuery({ queryKey: ["admin", "invitations", "count"], queryFn: () => adminApi.listInvitations({ pageSize: 1 }) });

  return (
    <div>
      <PageHeader title="Administration" description="Outils de gestion du contenu et de la communauté RailCards." />

      <Stagger className="mb-6 grid gap-3 sm:grid-cols-3">
        <StaggerItem>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Utilisateurs</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{usersQuery.data?.total ?? "…"}</p>
            </CardBody>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Signalements ouverts</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-rc-accent">{reportsQuery.data?.total ?? "…"}</p>
            </CardBody>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Invitations émises</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{invitationsQuery.data?.total ?? "…"}</p>
            </CardBody>
          </Card>
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <StaggerItem key={tile.href}>
            <Link href={tile.href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent">
              <Card interactive className="h-full">
                <CardBody className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-accent/12 text-rc-accent" aria-hidden="true">
                    <tile.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="font-semibold tracking-tight text-white">{tile.label}</p>
                    <p className="text-xs text-white/50">{tile.desc}</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminShell>
      <AdminOverview />
    </AdminShell>
  );
}
