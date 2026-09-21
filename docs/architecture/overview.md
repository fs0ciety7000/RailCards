# Architecture — vue d'ensemble

## Style architectural

RailCards est un **monolithe modulaire** côté backend (un seul processus NestJS, modules par domaine métier), conformément à la décision produit de ne pas introduire de microservices pour le MVP. Le frontend est une application Next.js séparée qui consomme l'API REST. Un worker BullMQ séparé gère les tâches différées.

```
┌──────────────┐      HTTPS/JSON       ┌──────────────────┐
│  apps/web    │ ────────────────────► │   apps/api        │
│  (Next.js)   │ ◄──────────────────── │   (NestJS)         │
└──────────────┘   WebSocket (notifs)  └─────────┬─────────┘
                                                   │
                                        ┌──────────┴──────────┐
                                        │                     │
                                 ┌──────▼──────┐      ┌───────▼──────┐
                                 │ PostgreSQL   │      │ Redis         │
                                 │ (Prisma)     │      │ (BullMQ/cache)│
                                 └──────────────┘      └───────┬──────┘
                                                                │
                                                        ┌───────▼──────┐
                                                        │ apps/worker   │
                                                        │ (BullMQ jobs) │
                                                        └───────────────┘
```

## Découpage par domaine (apps/api/src)

| Module | Responsabilité |
|---|---|
| `auth/` | Inscription, connexion, rotation de refresh token, invitations |
| `users/` | Profil courant (`/me`), profils publics |
| `catalog/` | Séries, raretés, définitions de cartes (lecture publique + écriture admin) |
| `collection/` | Inventaire d'un joueur, album, détail d'un exemplaire |
| `economy/` | Portefeuille (Wallet), journal des transactions, récompense quotidienne |
| `boosters/` | Définitions de boosters, pools versionnés, ouverture (tirage serveur) |
| `missions/` | Missions journalières, succès permanents, progression, réclamation de récompense |
| `trading/` | Propositions d'échange, acceptation/refus/annulation, transfert atomique |
| `market/` | Annonces à prix fixe, achat, gestion de la concurrence |
| `admin/` | CRUD catalogue/boosters, invitations, gestion des comptes, audit, signalements |
| `notifications/` | Notifications persistées + passerelle WebSocket (push best-effort) |
| `social/` | Signalement d'un autre joueur |

Chaque module suit le même schéma : un `*.service.ts` qui contient la logique (et les transactions Prisma), un `*.controller.ts` fin qui ne fait que valider/router, et un `*.module.ts` qui déclare les dépendances. Les services partagés (Wallet, Missions, Notifications) sont exportés par leur module et injectés là où ils sont nécessaires — par exemple `BoostersService` et `TradingService` importent tous deux `WalletService` et `MissionsService` plutôt que de dupliquer la logique de crédit/débit ou de progression.

## Autorité serveur

Le principe directeur de toute la couche économique : **le client ne fournit jamais de résultat, seulement une intention**. Concrètement :
- `POST /boosters/open` ne prend que `{ boosterSlug }` (+ un en-tête `Idempotency-Key`) — jamais de carte, de rareté ou de prix. Le tirage a lieu côté serveur dans `packages/game-domain/src/booster-draw.ts`, avec `crypto.randomInt` (CSPRNG), à l'intérieur d'une transaction Prisma qui débite le portefeuille et crée les instances de cartes de façon atomique.
- `POST /market/listings/:id/buy` ne prend aucun paramètre de prix : le prix vient de l'annonce en base.
- `POST /trades/:id/accept` revalide la propriété et l'état de **chaque** carte au moment de l'acceptation (pas seulement à la création de la proposition).

Voir [security.md](security.md) pour le détail des mécanismes de concurrence.

## Frontend (apps/web)

Next.js App Router, TypeScript strict, Tailwind CSS v4. Les appels serveur passent par TanStack Query ; les formulaires par React Hook Form + Zod (schémas partagés avec le backend via `packages/contracts` quand c'est pertinent). Le jeton d'accès (courte durée) est gardé en mémoire côté client — jamais en `localStorage` — et rafraîchi silencieusement via le cookie httpOnly de session avant expiration ou sur 401.

## Worker (apps/worker)

Un seul job récurrent pour le MVP : `expire-trades`, qui balaie toutes les 5 minutes les propositions d'échange dont la date d'expiration est dépassée et libère les cartes réservées côté initiateur. Ce n'est **pas** une garantie de correction — l'API elle-même expire aussi paresseusement une proposition dès qu'on tente de l'accepter après l'échéance — mais évite que des cartes restent bloquées indéfiniment si personne ne retente l'action.

## Pourquoi ces choix

- **NestJS** apporte une structure modulaire imposée (à l'inverse d'Express nu), l'injection de dépendances, la validation déclarative (`class-validator`), et Swagger généré automatiquement — utile pour un projet censé rester maintenable par une équipe.
- **Prisma** donne des migrations versionnées lisibles, un client typé de bout en bout, et surtout des transactions interactives (`$transaction(async (tx) => …)`) qui sont le mécanisme central de toute la couche économique.
- **Un seul processus API** pour le MVP : le trafic attendu (bêta privée) ne justifie pas la complexité opérationnelle de microservices. Le découpage en modules NestJS permet néanmoins d'extraire un domaine en service séparé plus tard sans réécriture complète.
