"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, CrAmount, EmptyState, Skeleton, Tabs } from "@railcards/ui";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface WalletTxRow {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  createdAt: string;
  wallet: { user: { username: string } };
}

interface MarketTxRow {
  id: string;
  priceCr: number;
  feeCr: number;
  createdAt: string;
  buyer: { username: string };
  seller: { username: string };
  listing: { cardInstance: { cardDefinition: { name: string } } };
}

type AuditRow = import("@/lib/types").AuditLogEntry;

function LedgerContent() {
  const [tab, setTab] = useState<"wallet" | "market" | "audit">("wallet");

  const walletQuery = useQuery({
    queryKey: ["admin", "ledger", "wallet"],
    queryFn: () => adminApi.walletTransactions({ pageSize: 50 }) as Promise<{ items: WalletTxRow[]; total: number }>,
    enabled: tab === "wallet",
  });
  const marketQuery = useQuery({
    queryKey: ["admin", "ledger", "market"],
    queryFn: () => adminApi.marketTransactions({ pageSize: 50 }) as Promise<{ items: MarketTxRow[]; total: number }>,
    enabled: tab === "market",
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "ledger", "audit"],
    queryFn: () => adminApi.auditLog({ pageSize: 50 }) as Promise<{ items: AuditRow[]; total: number }>,
    enabled: tab === "audit",
  });

  return (
    <AdminShell>
      <PageHeader title="Registres" description="Transactions et journal d'audit (lecture seule)." />
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "wallet", label: "Portefeuilles" },
            { id: "market", label: "Marché" },
            { id: "audit", label: "Journal d'audit" },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>

      {tab === "wallet" &&
        (walletQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (walletQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Aucune transaction" />
        ) : (
          <Table
            headers={["Utilisateur", "Type", "Montant", "Solde après", "Date"]}
            rows={walletQuery.data!.items.map((t) => [
              `@${t.wallet.user.username}`,
              t.type,
              <CrAmount key="a" value={t.amount} className={t.amount >= 0 ? "text-emerald-400" : "text-red-400"} />,
              <CrAmount key="b" value={t.balanceAfter} />,
              formatDateTime(t.createdAt),
            ])}
          />
        ))}

      {tab === "market" &&
        (marketQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (marketQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Aucune transaction" />
        ) : (
          <Table
            headers={["Carte", "Acheteur", "Vendeur", "Prix", "Frais", "Date"]}
            rows={marketQuery.data!.items.map((t) => [
              t.listing.cardInstance.cardDefinition.name,
              `@${t.buyer.username}`,
              `@${t.seller.username}`,
              <CrAmount key="a" value={t.priceCr} />,
              <CrAmount key="b" value={t.feeCr} />,
              formatDateTime(t.createdAt),
            ])}
          />
        ))}

      {tab === "audit" &&
        (auditQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (auditQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Aucune entrée" />
        ) : (
          <Table
            headers={["Action", "Cible", "Acteur", "Date"]}
            rows={auditQuery.data!.items.map((a) => [
              <Badge key="a">{a.action}</Badge>,
              `${a.targetType} · ${a.targetId.slice(0, 8)}…`,
              a.actor ? `@${a.actor.username}` : "système",
              formatDateTime(a.createdAt),
            ])}
          />
        ))}
    </AdminShell>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-rc-border bg-rc-night-light shadow-rc-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-rc-border-strong text-xs font-semibold uppercase tracking-wide text-white/40">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-rc-border transition-colors odd:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.035]">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-white/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminLedgerPage() {
  return <LedgerContent />;
}
