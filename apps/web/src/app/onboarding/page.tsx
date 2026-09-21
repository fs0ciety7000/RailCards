"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, CardBody, CrAmount, Spinner } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { usersApi } from "@/lib/api";

function OnboardingContent() {
  const router = useRouter();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: usersApi.me });

  function dismiss(path: string) {
    try {
      localStorage.removeItem("railcards.needsOnboarding");
    } catch {
      // ignore
    }
    router.replace(path);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-rc-night bg-rail-lines px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold text-white">Bienvenue à bord !</h1>
        <p className="mt-2 text-white/70">
          Votre compte RailCards est prêt. Un bonus de bienvenue vous attend déjà dans votre portefeuille.
        </p>

        <Card className="mt-6">
          <CardBody className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm font-medium uppercase tracking-wide text-white/50">Bonus de bienvenue</p>
            {meQuery.isLoading ? (
              <Spinner />
            ) : (
              <p className="font-display text-4xl font-bold text-rc-accent">
                <CrAmount value={meQuery.data?.walletBalance ?? 500} />
              </p>
            )}
            <p className="text-sm text-white/60">
              Utilisez vos Crédits Rail pour ouvrir votre premier booster et démarrer votre collection.
            </p>
          </CardBody>
        </Card>

        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={() => dismiss("/boosters")}>
            Ouvrir mon premier booster
          </Button>
          <Button variant="ghost" onClick={() => dismiss("/home")}>
            Découvrir l&apos;accueil d&apos;abord
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingContent />
    </RequireAuth>
  );
}
