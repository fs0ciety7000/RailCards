"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, ShieldCheck, Search } from "lucide-react";
import { Badge, Button, Card, CardBody, ConfirmDialog, Input, Skeleton, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";

function AdminUsersContent() {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ id: string; action: "suspend" | "reactivate" } | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => adminApi.listUsers({ search: search || undefined, pageSize: 50 }),
  });

  const mutation = useMutation({
    mutationFn: () => (target!.action === "suspend" ? adminApi.suspendUser(target!.id) : adminApi.reactivateUser(target!.id)),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Compte mis à jour" });
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) });
      setTarget(null);
    },
  });

  return (
    <AdminShell>
      <PageHeader title="Utilisateurs" description="Rechercher, suspendre ou réactiver des comptes." />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
        <Input
          aria-label="Rechercher un utilisateur"
          placeholder="Rechercher par nom d'utilisateur ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card>
        <CardBody className="overflow-x-auto">
          {usersQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
                  <th className="py-2.5">Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Inscrit le</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] hover:bg-white/[0.035]">
                    <td className="py-2.5 font-medium text-white">
                      {u.displayName} <span className="text-white/40">@{u.username}</span>
                    </td>
                    <td className="text-white/60">{u.email}</td>
                    <td className="text-white/60">{u.role}</td>
                    <td>
                      <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                    </td>
                    <td className="text-white/60">{formatDate(u.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      {u.role !== "ADMIN" &&
                        (u.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
                            onClick={() => setTarget({ id: u.id, action: "suspend" })}
                            className="hover:bg-rc-danger/10"
                            style={{ color: "var(--color-rc-danger)" }}
                          >
                            Suspendre
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                            onClick={() => setTarget({ id: u.id, action: "reactivate" })}
                          >
                            Réactiver
                          </Button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        destructive={target?.action === "suspend"}
        title={target?.action === "suspend" ? "Suspendre ce compte ?" : "Réactiver ce compte ?"}
        description={
          target?.action === "suspend"
            ? "Le compte sera immédiatement déconnecté et ne pourra plus se reconnecter."
            : "Le compte pourra de nouveau se connecter normalement."
        }
        confirmLabel={target?.action === "suspend" ? "Suspendre" : "Réactiver"}
      />
    </AdminShell>
  );
}

export default function AdminUsersPage() {
  return <AdminUsersContent />;
}
