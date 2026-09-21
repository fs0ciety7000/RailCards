"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flag, XCircle } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, Select, Skeleton, useToast } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "danger" | "info"> = {
  OPEN: "info",
  REVIEWING: "accent",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

function AdminReportsContent() {
  const [status, setStatus] = useState("OPEN");
  const toast = useToast();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: () => adminApi.listReports({ status: status || undefined, pageSize: 50 }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: "RESOLVED" | "DISMISSED" }) =>
      adminApi.resolveReport(id, resolution),
    onSuccess: () => {
      toast.show({ tone: "success", title: "Signalement mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
    onError: (err) => toast.show({ tone: "error", title: "Échec", description: getErrorMessage(err) }),
  });

  return (
    <AdminShell>
      <PageHeader title="Signalements" description="Modérez les signalements des joueurs." />
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 w-auto" aria-label="Filtrer par statut">
        <option value="OPEN">Ouverts</option>
        <option value="REVIEWING">En cours</option>
        <option value="RESOLVED">Résolus</option>
        <option value="DISMISSED">Rejetés</option>
        <option value="">Tous</option>
      </Select>

      {reportsQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (reportsQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Aucun signalement" />
      ) : (
        <div className="space-y-3">
          {reportsQuery.data!.items.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Flag className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden="true" />
                    {r.reason}
                  </p>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                </div>
                {r.details && <p className="mb-2 text-sm text-white/60">{r.details}</p>}
                <p className="text-xs text-white/40">Signalé le {formatDateTime(r.createdAt)}</p>
                {r.status === "OPEN" || r.status === "REVIEWING" ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      loading={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ id: r.id, resolution: "RESOLVED" })}
                    >
                      Marquer résolu
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                      loading={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ id: r.id, resolution: "DISMISSED" })}
                    >
                      Rejeter
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminReportsPage() {
  return <AdminReportsContent />;
}
