"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@railcards/ui";
import { tryRefresh } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function SessionBootstrap() {
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;
    // tryRefresh() itself sets the session on success and is a shared
    // singleton in-flight call, so a Strict Mode double-invoke of this
    // effect never sends two competing /auth/refresh requests.
    tryRefresh().finally(() => {
      if (!cancelled) setHydrated();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionBootstrap />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
