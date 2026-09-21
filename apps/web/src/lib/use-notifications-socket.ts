"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store";
import { useToast } from "@railcards/ui";
import type { AppNotification } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

const NOTIF_LABELS: Record<string, string> = {
  TRADE_RECEIVED: "Nouvelle proposition d'échange",
  TRADE_ACCEPTED: "Échange accepté",
  TRADE_REJECTED: "Échange refusé",
  TRADE_CANCELLED: "Échange annulé",
  TRADE_COUNTERED: "Contre-offre reçue",
  TRADE_EXPIRED: "Échange expiré",
  MARKET_SOLD: "Une de vos cartes a été vendue",
  MISSION_COMPLETED: "Mission complétée",
  ACHIEVEMENT_UNLOCKED: "Haut fait débloqué",
  SYSTEM: "Notification",
};

/**
 * Live-push fallback: connects to the /realtime namespace and, on each
 * "notification" event, invalidates the notifications query and surfaces a
 * toast. TanStack Query polling (refetchInterval) remains the source of
 * truth if the socket never connects.
 */
export function useNotificationsSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!accessToken) return;
    let socket: Socket | null = null;
    try {
      socket = io(`${WS_URL}/realtime`, {
        auth: { token: accessToken },
        transports: ["websocket", "polling"],
      });
      socket.on("notification", (notification: AppNotification) => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toast.show({
          tone: "info",
          title: NOTIF_LABELS[notification.type] ?? "Notification",
        });
      });
    } catch {
      // socket layer is a nice-to-have; polling covers this if it fails
    }
    return () => {
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
}
