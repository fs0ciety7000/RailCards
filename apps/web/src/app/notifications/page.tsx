"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Skeleton } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { notificationsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { NOTIFICATION_LABELS, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

function NotificationsContent() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const notifQuery = useQuery({
    queryKey: ["notifications", "list", page],
    queryFn: () => notificationsApi.list({ page, pageSize: PAGE_SIZE }),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={notifQuery.data ? `${notifQuery.data.unreadCount} non lue(s)` : undefined}
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!notifQuery.data?.unreadCount}
            loading={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            Tout marquer comme lu
          </Button>
        }
      />

      {notifQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifQuery.isError ? (
        <ErrorState description={getErrorMessage(notifQuery.error)} action={<Button onClick={() => notifQuery.refetch()}>Réessayer</Button>} />
      ) : notifQuery.data!.items.length === 0 ? (
        <EmptyState icon={<Bell />} title="Aucune notification" description="Vous êtes à jour." />
      ) : (
        <>
          <Stagger className="space-y-2">
            {notifQuery.data!.items.map((n) => (
              <StaggerItem key={n.id}>
                <Card className={n.readAt ? "opacity-70" : "border-rc-accent/40"}>
                  <CardBody className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={n.readAt ? "text-sm text-white/70" : "text-sm font-semibold text-white"}>
                          {NOTIFICATION_LABELS[n.type] ?? n.type}
                        </p>
                        {!n.readAt && <Badge tone="accent">Nouveau</Badge>}
                      </div>
                      <p className="text-xs text-white/40">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {!n.readAt && (
                      <Button size="sm" variant="ghost" onClick={() => markReadMutation.mutate(n.id)}>
                        Marquer comme lu
                      </Button>
                    )}
                  </CardBody>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="text-sm text-white/60">
              Page {page} / {Math.max(1, notifQuery.data!.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= notifQuery.data!.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <NotificationsContent />
      </AppShell>
    </RequireAuth>
  );
}
