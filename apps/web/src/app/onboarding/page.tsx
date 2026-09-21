"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { PartyPopper } from "lucide-react";
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center"
      >
        <motion.span
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rc-accent text-rc-night shadow-rc-glow"
          aria-hidden="true"
        >
          <PartyPopper className="h-8 w-8" strokeWidth={2} />
        </motion.span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Bienvenue à bord !</h1>
        <p className="mt-2 text-white/65">
          Votre compte RailCards est prêt. Un bonus de bienvenue vous attend déjà dans votre portefeuille.
        </p>

        <Card className="mt-6">
          <CardBody className="flex flex-col items-center gap-2 py-8">
            <p className="text-sm font-medium uppercase tracking-wide text-white/50">Bonus de bienvenue</p>
            {meQuery.isLoading ? (
              <Spinner />
            ) : (
              <p className="text-4xl font-bold tracking-tight text-rc-accent">
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
      </motion.div>
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
