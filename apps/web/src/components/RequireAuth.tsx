"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@railcards/ui";
import { useAuthStore } from "@/lib/auth-store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace("/login");
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-rc-night">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && (!user || user.role !== "ADMIN")) {
      router.replace(user ? "/home" : "/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-rc-night">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
