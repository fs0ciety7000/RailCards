"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { EmptyState, ErrorState, Skeleton, Tabs } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stagger, StaggerItem } from "@/components/Stagger";
import { ActivityEventRow } from "@/components/ActivityEventRow";
import { activityApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function ActivityContent() {
  const [scope, setScope] = useState<"all" | "friends">("all");
  const feedQuery = useQuery({
    queryKey: ["activity", scope],
    queryFn: () => activityApi.feed(50, scope),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <PageHeader title="Fil d'activité" description="Les derniers faits marquants du réseau, en temps réel." />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "all", label: "Tout le réseau" },
            { id: "friends", label: "Amis" },
          ]}
          activeId={scope}
          onChange={(id) => setScope(id as "all" | "friends")}
        />
      </div>

      {feedQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : feedQuery.isError ? (
        <ErrorState description={getErrorMessage(feedQuery.error)} />
      ) : feedQuery.data!.length === 0 ? (
        <EmptyState
          icon={<Radio />}
          title="Rien à signaler"
          description={scope === "friends" ? "Aucune activité récente chez vos amis. Ajoutez-en depuis la page Amis." : "Le réseau est calme pour l'instant."}
        />
      ) : (
        <Stagger className="space-y-2">
          {feedQuery.data!.map((event, i) => (
            <StaggerItem key={i}>
              <ActivityEventRow event={event} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <RequireAuth>
      <AppShell>
        <ActivityContent />
      </AppShell>
    </RequireAuth>
  );
}
