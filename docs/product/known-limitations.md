# Limites connues du MVP

Liste honnête de ce qui n'est pas (encore) fait, pour éviter toute ambiguïté sur le périmètre livré.

## Fonctionnel

- **Combats** : le modèle de données prévoit des statistiques de combat par carte (`combatStats`, `combatStatsEnabled`), mais aucun système de combat, matchmaking ou tournoi n'existe. C'est un choix produit assumé (voir la mission), pas un oubli.
- **Contre-proposition d'échange** : le modèle (`Trade.parentTradeId`) et le statut `COUNTERED` existent dans le schéma pour supporter une contre-proposition, mais l'endpoint dédié (`POST /trades/:id/counter`) n'a pas été implémenté dans ce MVP — un joueur peut annuler une proposition reçue et en créer une nouvelle à la place, ce qui couvre le même besoin avec une étape manuelle en plus.
- **Vérification d'email** : le champ `emailVerifiedAt` existe, mais aucun fournisseur SMTP n'est branché par défaut (voir `.env.example`, `SMTP_*`). En développement, aucun email n'est réellement envoyé.
- **Réinitialisation de mot de passe** : le modèle (`PasswordResetToken`) est prêt, mais les endpoints `/auth/forgot-password` et `/auth/reset-password` ne sont pas implémentés côté API dans ce MVP (le schéma Zod `requestPasswordResetSchema`/`resetPasswordSchema` existe côté contrats pour un branchement futur rapide).
- **Live Ops / Événements** : le modèle `Event` existe (séries/événements limités dans le temps), mais aucun endpoint ni écran ne l'exploite encore — prêt pour une itération post-MVP.
- **Blocage entre joueurs** : le signalement (`Report`) est fonctionnel, mais il n'y a pas de fonctionnalité de blocage à proprement parler (empêcher un joueur de vous proposer des échanges, par exemple).

## Technique

- **Stockage objet (S3)** non branché — les illustrations sont des placeholders SVG statiques servis par le frontend. Le champ `imageUrl` en base accepte déjà n'importe quelle URL, donc brancher un vrai bucket S3-compatible (ou un stockage local en dev, comme prévu) est un changement localisé.
- **Notifications temps réel** (Socket.IO) fonctionnent pour une seule instance API — passer à plusieurs instances nécessite l'adaptateur Redis officiel de Socket.IO (non branché). Les notifications restent fonctionnelles sans WebSocket (persistées en base, récupérables par polling), donc ce n'est pas bloquant.
- **Observabilité** : les variables `SENTRY_DSN` et `OTEL_EXPORTER_OTLP_ENDPOINT` existent dans `.env.example` mais aucun SDK Sentry/OpenTelemetry n'est initialisé dans le code — préparé, pas branché.
- **Rate limiting** global et basique (300 req/min/IP), pas de limite spécifique par endpoint sensible. Voir [architecture/security.md](../architecture/security.md).
- **Numérotation de série des exemplaires** (`CardInstance.serialNumber`) non garantie strictement séquentielle sous forte concurrence (purement cosmétique, aucune garantie économique n'en dépend). Voir [architecture/security.md](../architecture/security.md).
- **Pas de test de charge** ni de test de résilience réseau explicite.
- **Pas d'audit de sécurité externe.**

## Frontend

Voir le rapport livré avec `apps/web` pour le détail exact de ce qui a été construit vs. simplifié dans l'interface (généré séparément par l'équipe frontend de ce projet — consultez le dernier message de session ou l'historique de commit pour le détail à jour).

## Ce qui est en revanche solide

Pour équilibrer cette liste : le cœur économique (portefeuille, boosters, marché, échanges) est **testé par intégration contre une vraie base PostgreSQL**, y compris les scénarios de concurrence (double achat simultané), et n'a présenté aucune anomalie lors des vérifications manuelles effectuées pendant le développement (voir [architecture/testing.md](../architecture/testing.md)).
