export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-BE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const CARD_CATEGORY_LABELS: Record<string, string> = {
  ROLLING_STOCK: "Matériel roulant",
  STATION_PLACE: "Gares & lieux",
  PROFESSION: "Métiers",
  DAILY_LIFE_HUMOR: "Vie quotidienne",
  SPECIAL_EDITION: "Édition spéciale",
};

export const ACQUISITION_LABELS: Record<string, string> = {
  BOOSTER: "Booster",
  TRADE: "Échange",
  MARKET: "Marché",
  ADMIN_GRANT: "Don administrateur",
  MISSION_REWARD: "Récompense de mission",
  ACHIEVEMENT_REWARD: "Récompense de haut fait",
};

export const TRADE_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  COUNTERED: "Contre-offre",
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  TRADE_RECEIVED: "Nouvelle proposition d'échange reçue",
  TRADE_ACCEPTED: "Votre échange a été accepté",
  TRADE_REJECTED: "Votre échange a été refusé",
  TRADE_CANCELLED: "Un échange a été annulé",
  TRADE_COUNTERED: "Contre-offre reçue",
  TRADE_EXPIRED: "Un échange a expiré",
  MARKET_SOLD: "Une de vos cartes a été vendue",
  MISSION_COMPLETED: "Mission complétée",
  ACHIEVEMENT_UNLOCKED: "Haut fait débloqué",
  SYSTEM: "Notification système",
};
