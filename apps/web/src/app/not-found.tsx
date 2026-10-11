import type { Metadata } from "next";
import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { EmptyState, buttonClassName } from "@railcards/ui";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-rc-night bg-rail-lines px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="sr-only">Page introuvable</h1>
        <EmptyState
          icon={<MapPinOff />}
          title="Cette page n’existe pas"
          description="Le lien est peut-être erroné, ou la page a été déplacée. Votre collection, elle, est toujours là. (Erreur 404)"
          action={
            <Link href="/" className={buttonClassName({ variant: "primary", className: "min-h-11" })}>
              Retour à l’accueil
            </Link>
          }
        />
      </div>
    </main>
  );
}
