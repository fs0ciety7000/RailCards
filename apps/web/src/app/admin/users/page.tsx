"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      <Input
        aria-label="Rechercher un utilisateur"
        placeholder="Rechercher par nom d'utilisateur ou email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <Card>
        <CardBody className="overflow-x-auto">
          {usersQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/40">
                  <th className="py-2">Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Inscrit le</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="py-2 font-medium text-white">
                      {u.displayName} <span className="text-white/40">@{u.username}</span>
                    </td>
                    <td className="text-white/60">{u.email}</td>
                    <td className="text-white/60">{u.role}</td>
                    <td>
                      <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                    </td>
                    <td className="text-white/60">{formatDate(u.createdAt)}</td>
                    <td className="py-2 text-right">
                      {u.role !== "ADMIN" &&
                        (u.status === "ACTIVE" ? (
                          <Button size="sm" variant="danger" onClick={() => setTarget({ id: u.id, action: "suspend" })}>
                            Suspendre
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setTarget({ id: u.id, action: "reactivate" })}>
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
