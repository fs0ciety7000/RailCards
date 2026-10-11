"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, ErrorState, buttonClassName } from "@railcards/ui";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-rc-night bg-rail-lines px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="sr-only">Une erreur est survenue</h1>
        <ErrorState
          title="Un petit incident sur la ligne"
          description="Cette page n’a pas pu s’afficher. Réessayez : vos cartes et vos Crédits Rail ne sont pas touchés."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => retry()} className="min-h-11">
                Réessayer
              </Button>
              <Link href="/" className={buttonClassName({ variant: "secondary", className: "min-h-11" })}>
                Accueil
              </Link>
            </div>
          }
        />
      </div>
    </main>
  );
}
