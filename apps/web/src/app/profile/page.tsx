"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { usersApi } from "@/lib/api";

function RedirectToOwnProfile() {
  const router = useRouter();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });

  useEffect(() => {
    if (meQuery.data) router.replace(`/profile/${meQuery.data.username}`);
  }, [meQuery.data, router]);

  return (
    <div className="flex justify-center py-10">
      <Spinner />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <AppShell>
        <RedirectToOwnProfile />
      </AppShell>
    </RequireAuth>
  );
}
