/** Compact "2j 4h", "3h 12m", "45m", "Terminée" style countdown for auction end times. */
export function formatTimeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Terminée";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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

export const MISSION_GOAL_TYPE_LABELS: Record<string, string> = {
  OPEN_BOOSTER: "Ouvrir un booster",
  COLLECT_UNIQUE_CARDS: "Collectionner des cartes uniques",
  COMPLETE_TRADE: "Compléter un échange",
  SELL_ON_MARKET: "Vendre sur le marché",
  BUY_ON_MARKET: "Acheter sur le marché",
  LOGIN: "Se connecter",
  COMPLETE_SERIES: "Compléter une série",
};

export const ACQUISITION_LABELS: Record<string, string> = {
  BOOSTER: "Booster",
  TRADE: "Échange",
  MARKET: "Marché",
  ADMIN_GRANT: "Don administrateur",
  MISSION_REWARD: "Récompense de mission",
  ACHIEVEMENT_REWARD: "Récompense de haut fait",
  FOUNDER_GRANT: "Carte fondateurs",
  CRAFT: "Fusion",
};

export const TRADE_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  COUNTERED: "Contre-offre",
};

export const DUEL_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Résolu",
  DECLINED: "Refusé",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
};

export const DUEL_STAT_LABELS: Record<string, string> = {
  POWER: "Puissance",
  RELIABILITY: "Fiabilité",
  CHARM: "Charme",
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  TRADE_RECEIVED: "Nouvelle proposition d'échange reçue",
  TRADE_ACCEPTED: "Votre échange a été accepté",
  TRADE_REJECTED: "Votre échange a été refusé",
  TRADE_CANCELLED: "Un échange a été annulé",
  TRADE_COUNTERED: "Contre-offre reçue",
  TRADE_EXPIRED: "Un échange a expiré",
  MARKET_SOLD: "Une de vos cartes a été vendue",
  AUCTION_OUTBID: "Vous avez été surenchéri",
  AUCTION_NEW_BID: "Nouvelle enchère sur votre annonce",
  AUCTION_WON: "Vous avez remporté une enchère",
  AUCTION_ENDED_NO_BIDS: "Votre enchère s'est terminée sans offre",
  GUILD_KICKED: "Vous avez été exclu de votre guilde",
  GUILD_PROMOTED: "Vous avez été promu officier",
  GUILD_DEMOTED: "Vous n'êtes plus officier",
  GUILD_LEADERSHIP_TRANSFERRED: "Vous êtes maintenant chef de guilde",
  GUILD_DISBANDED: "Votre guilde a été dissoute",
  QUEST_STEP_COMPLETED: "Étape de quête terminée",
  QUEST_COMPLETED: "Quête saisonnière terminée",
  WANTED_CARD_LISTED: "Une carte que vous recherchez est en vente",
  GUILD_WAR_REWARD: "Récompense de guerre de guildes",
  MISSION_COMPLETED: "Mission complétée",
  ACHIEVEMENT_UNLOCKED: "Haut fait débloqué",
  LEVEL_UP: "Niveau supérieur",
  CREDITS_EARNED: "Crédits reçus",
  SERIES_COMPLETED: "Série complétée",
  DUEL_RECEIVED: "Défi reçu",
  DUEL_RESOLVED: "Duel résolu",
  DUEL_DECLINED: "Défi refusé",
  DUEL_CANCELLED: "Duel annulé",
  DUEL_EXPIRED: "Défi expiré",
  SYSTEM: "Notification système",
};

/**
 * Richer, payload-aware text for notification types where the raw label
 * alone loses the interesting detail (which mission, how many CR, which
 * level). Falls back to the static label for everything else.
 */
export function notificationMessage(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "MISSION_COMPLETED":
      return typeof payload.title === "string" ? `Mission complétée : ${payload.title}` : NOTIFICATION_LABELS[type]!;
    case "ACHIEVEMENT_UNLOCKED":
      return typeof payload.title === "string" ? `Haut fait débloqué : ${payload.title}` : NOTIFICATION_LABELS[type]!;
    case "LEVEL_UP":
      return typeof payload.newLevel === "number"
        ? `Niveau ${payload.newLevel} atteint${typeof payload.newGrade === "string" && payload.newGrade ? ` — ${payload.newGrade}` : ""} !`
        : NOTIFICATION_LABELS[type]!;
    case "CREDITS_EARNED":
      return typeof payload.amount === "number"
        ? `+${payload.amount} CR reçus${typeof payload.reason === "string" && payload.reason ? ` — ${payload.reason}` : ""}`
        : NOTIFICATION_LABELS[type]!;
    case "SERIES_COMPLETED":
      return typeof payload.seriesName === "string"
        ? `Série complétée : ${payload.seriesName} !`
        : NOTIFICATION_LABELS[type]!;
    case "DUEL_RECEIVED":
      return typeof payload.wagerCr === "number"
        ? `Défi de duel reçu — ${payload.wagerCr} CR en jeu`
        : NOTIFICATION_LABELS[type]!;
    case "DUEL_RESOLVED": {
      const stat = typeof payload.stat === "string" ? DUEL_STAT_LABELS[payload.stat] ?? payload.stat : null;
      if (!stat) return NOTIFICATION_LABELS[type]!;
      return payload.winnerId
        ? `Duel résolu sur ${stat} — un vainqueur repart avec ${payload.wagerCr as number} CR`
        : `Duel résolu sur ${stat} — égalité, personne ne gagne le pari`;
    }
    case "AUCTION_OUTBID":
      return typeof payload.newBidCr === "number"
        ? `Vous avez été surenchéri — nouvelle offre à ${payload.newBidCr} CR`
        : NOTIFICATION_LABELS[type]!;
    case "AUCTION_NEW_BID":
      return typeof payload.amountCr === "number"
        ? `Nouvelle enchère reçue — ${payload.amountCr} CR`
        : NOTIFICATION_LABELS[type]!;
    case "AUCTION_WON":
      return typeof payload.priceCr === "number"
        ? `Enchère remportée pour ${payload.priceCr} CR`
        : NOTIFICATION_LABELS[type]!;
    case "QUEST_STEP_COMPLETED":
      return typeof payload.title === "string" ? `Étape terminée : ${payload.title}` : NOTIFICATION_LABELS[type]!;
    case "QUEST_COMPLETED":
      return typeof payload.title === "string" ? `Quête terminée : ${payload.title} !` : NOTIFICATION_LABELS[type]!;
    case "WANTED_CARD_LISTED":
      return typeof payload.cardName === "string" && typeof payload.priceCr === "number"
        ? `"${payload.cardName}" recherchée vient d'être mise en vente pour ${payload.priceCr} CR`
        : NOTIFICATION_LABELS[type]!;
    case "GUILD_WAR_REWARD":
      return typeof payload.rank === "number" && typeof payload.rewardCr === "number" && typeof payload.guildName === "string"
        ? `${payload.guildName} termine ${payload.rank === 1 ? "1ère" : `${payload.rank}e`} de la guerre de guildes — +${payload.rewardCr} CR`
        : NOTIFICATION_LABELS[type]!;
    case "SYSTEM":
      return typeof payload.message === "string" ? payload.message : NOTIFICATION_LABELS[type]!;
    default:
      return NOTIFICATION_LABELS[type] ?? type;
  }
}
