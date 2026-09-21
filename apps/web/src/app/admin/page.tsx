"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";

const TILES = [
  { href: "/admin/cards", label: "Cartes", icon: "🃏", desc: "Créer, publier et archiver des cartes" },
  { href: "/admin/series", label: "Séries", icon: "📚", desc: "Gérer les séries de collection" },
  { href: "/admin/boosters", label: "Boosters", icon: "🎁", desc: "Définitions et pools de tirage" },
  { href: "/admin/invitations", label: "Invitations", icon: "✉️", desc: "Générer des codes d'invitation" },
  { href: "/admin/users", label: "Utilisateurs", icon: "👥", desc: "Suspendre / réactiver des comptes" },
  { href: "/admin/reports", label: "Signalements", icon: "🚩", desc: "Modération des signalements" },
  { href: "/admin/ledger", label: "Registres", icon: "📒", desc: "Transactions & journal d'audit" },
];

function AdminOverview() {
  const usersQuery = useQuery({ queryKey: ["admin", "users", "count"], queryFn: () => adminApi.listUsers({ pageSize: 1 }) });
  const reportsQuery = useQuery({ queryKey: ["admin", "reports", "open"], queryFn: () => adminApi.listReports({ status: "OPEN", pageSize: 1 }) });
  const invitationsQuery = useQuery({ queryKey: ["admin", "invitations", "count"], queryFn: () => adminApi.listInvitations({ pageSize: 1 }) });

  return (
    <div>
      <PageHeader title="Administration" description="Outils de gestion du contenu et de la communauté RailCards." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-white/50">Utilisateurs</p>
            <p className="mt-1 text-2xl font-bold text-white">{usersQuery.data?.total ?? "…"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-white/50">Signalements ouverts</p>
            <p className="mt-1 text-2xl font-bold text-rc-accent">{reportsQuery.data?.total ?? "…"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-white/50">Invitations émises</p>
            <p className="mt-1 text-2xl font-bold text-white">{invitationsQuery.data?.total ?? "…"}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <Card className="h-full transition hover:border-rc-accent/50">
              <CardBody className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {tile.icon}
                </span>
                <div>
                  <p className="font-semibold text-white">{tile.label}</p>
                  <p className="text-xs text-white/50">{tile.desc}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
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
