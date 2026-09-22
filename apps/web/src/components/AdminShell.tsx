"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@railcards/ui";
import { RequireAdmin } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";

const ADMIN_TABS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/cards", label: "Cartes" },
  { href: "/admin/series", label: "Séries" },
  { href: "/admin/boosters", label: "Boosters" },
  { href: "/admin/missions", label: "Missions" },
  { href: "/admin/grades", label: "Rangs" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/reports", label: "Signalements" },
  { href: "/admin/ledger", label: "Registres" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAdmin>
      <AppShell>
        <div className="mb-6 overflow-x-auto">
          <nav
            aria-label="Navigation administration"
            className="flex w-fit gap-1 whitespace-nowrap rounded-xl border border-rc-border bg-white/[0.03] p-1"
          >
            {ADMIN_TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-accent",
                    active ? "bg-rc-accent text-rc-night" : "text-white/60 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {children}
      </AppShell>
    </RequireAdmin>
  );
}
