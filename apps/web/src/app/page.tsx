"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@railcards/ui";
import { useAuthStore } from "@/lib/auth-store";

export default function RootPage() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(accessToken ? "/home" : "/login");
  }, [hydrated, accessToken, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-rc-night">
      <Spinner />
    </div>
  );
}
