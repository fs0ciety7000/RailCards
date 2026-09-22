# Limites connues du MVP

Liste honnête de ce qui n'est pas (encore) fait, pour éviter toute ambiguïté sur le périmètre livré.

## Fonctionnel

- **Combats** : le modèle de données prévoit des statistiques de combat par carte (`combatStats`, `combatStatsEnabled`, éditables depuis Admin > Cartes), mais aucun système de combat, matchmaking ou tournoi n'existe. C'est un choix produit assumé (voir la mission), pas un oubli.
- **Vérification d'email** : le champ `emailVerifiedAt` existe, mais aucun fournisseur SMTP n'est branché par défaut (voir `.env.example`, `SMTP_*`). En développement, aucun email n'est réellement envoyé.
- **Réinitialisation de mot de passe** : le modèle (`PasswordResetToken`) est prêt, mais les endpoints `/auth/forgot-password` et `/auth/reset-password` ne sont pas implémentés côté API dans ce MVP (le schéma Zod `requestPasswordResetSchema`/`resetPasswordSchema` existe côté contrats pour un branchement futur rapide).
- **Live Ops / Événements** : le modèle `Event` existe (séries/événements limités dans le temps), mais aucun endpoint ni écran ne l'exploite encore — prêt pour une itération post-MVP.
- **Blocage entre joueurs** : le signalement (`Report`) est fonctionnel, mais il n'y a pas de fonctionnalité de blocage à proprement parler (empêcher un joueur de vous proposer des échanges, par exemple).

## Technique

- **Stockage objet (S3)** non branché — l'admin peut uploader une image (carte/booster) depuis Admin > Cartes/Boosters, mais elle atterrit sur le disque local du conteneur `api` (`apps/api/src/storage`), pas sur un bucket S3-compatible ; ne fonctionnerait pas tel quel avec plusieurs réplicas de l'API. Le champ `imageUrl` en base accepte n'importe quelle URL, donc brancher un vrai bucket S3-compatible reste un changement localisé à `StorageService`. **Une carte peut déjà avoir une vraie photo** : `SeedCard.imageUrl` (optionnel, `prisma/seed-data/cards.ts`) écrase le placeholder de rareté — utilisé pour la première fois sur « Desiro ML — L'Étoile Filante » (`apps/web/public/card-art/`). Le cadre premium (bordure par rareté, glow, tilt/glare) s'applique automatiquement autour de n'importe quelle image, réelle ou générée. Décision produit : le reste du catalogue (52 cartes) garde l'art abstrait pour l'instant ; du vrai visuel sera ajouté carte par carte à la demande, pas par une campagne de sourcing systématique.
- **Notifications temps réel** (Socket.IO) fonctionnent pour une seule instance API — passer à plusieurs instances nécessite l'adaptateur Redis officiel de Socket.IO (non branché). Les notifications restent fonctionnelles sans WebSocket (persistées en base, récupérables par polling), donc ce n'est pas bloquant.
- **Observabilité** : les variables `SENTRY_DSN` et `OTEL_EXPORTER_OTLP_ENDPOINT` existent dans `.env.example` mais aucun SDK Sentry/OpenTelemetry n'est initialisé dans le code — préparé, pas branché.
- **Rate limiting** global et basique (300 req/min/IP), pas de limite spécifique par endpoint sensible. Voir [architecture/security.md](../architecture/security.md).
- **Numérotation de série des exemplaires** (`CardInstance.serialNumber`) non garantie strictement séquentielle sous forte concurrence (purement cosmétique, aucune garantie économique n'en dépend). Voir [architecture/security.md](../architecture/security.md).
- **Pas de test de charge** ni de test de résilience réseau explicite.
- **Pas d'audit de sécurité externe.**

## Frontend

- **Signalement depuis un profil public** : pas de bouton « signaler » sur l'écran de profil joueur, car `POST /reports` a besoin de l'`userId` de la cible et le profil public n'expose que le `username` — plutôt que de câbler un faux bouton, il a été omis (règle : aucun bouton qui ne fait rien).
- **Sélecteurs admin** : les formulaires d'administration (carte, booster, série) utilisent des `<select>` HTML natifs sur les identifiants plutôt que des combobox avec recherche — fonctionnel pour un catalogue de la taille actuelle (53 cartes), à améliorer si le catalogue grossit significativement.
- **Sélection de cartes pour vente/échange** : récupère jusqu'à 100 cartes disponibles en une seule requête plutôt qu'un sélecteur paginé (côté proposeur et côté destinataire demandé) — largement suffisant pour ce MVP, à revisiter pour une collection de plusieurs centaines de cartes.

Le reste des 15 écrans demandés est implémenté et branché sur l'API réelle (pas de données simulées), avec états de chargement/vide/erreur, dialogues de confirmation avant toute action irréversible, et raretés toujours affichées avec couleur **et** texte. Vérifié par un parcours de bout en bout en navigateur réel (voir [architecture/testing.md](../architecture/testing.md)).

## Ce qui est en revanche solide

Pour équilibrer cette liste : le cœur économique (portefeuille, boosters, marché, échanges) est **testé par intégration contre une vraie base PostgreSQL**, y compris les scénarios de concurrence (double achat simultané), et n'a présenté aucune anomalie lors des vérifications manuelles effectuées pendant le développement (voir [architecture/testing.md](../architecture/testing.md)).
