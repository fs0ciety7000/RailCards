# RailCards

RailCards est un jeu web de collection de cartes multijoueur, dans un univers mêlant réalisme ferroviaire belge et humour du quotidien. Collection uniquement au lancement (les combats sont prévus dans le modèle de données mais désactivés — voir [docs/product/known-limitations.md](docs/product/known-limitations.md)).

Ce dépôt contient un **MVP réellement fonctionnel** : inscription sur invitation, catalogue de 53 cartes fictives, ouverture de boosters avec tirage 100% serveur, monnaie virtuelle (Crédits Rail), échanges entre joueurs, marché à prix fixe, missions/succès, et une administration protégée.

## Stack technique

| Domaine | Choix | Pourquoi |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Un seul dépôt, builds incrémentaux/cache partagé |
| Frontend | Next.js (App Router) + React 19 + TypeScript strict + Tailwind CSS v4 | Stack demandée, rendu hybride, DX moderne |
| Données serveur (frontend) | TanStack Query | Cache, retry, invalidation |
| Formulaires | React Hook Form + Zod | Validation typée partagée avec `packages/contracts` |
| Backend | NestJS 10 (Express) | Modulaire par domaine, DI, Swagger natif, testable |
| Base de données | PostgreSQL 16 + Prisma ORM | Transactions ACID, contraintes fortes, migrations versionnées |
| Cache / files | Redis 7 + BullMQ | Tâches différées (voir `apps/worker`) |
| Auth | JWT (access, 15 min) + session opaque en cookie httpOnly (refresh, 30 j) + bcrypt | Pas de dépendance externe payante, rotation de refresh token, révocation en base |
| Tests | Jest (`apps/api`, idiomatique NestJS) + Vitest (`packages/*`) + Playwright (E2E, à venir) | Voir [Tests](#tests) |
| CI | GitHub Actions | Lint, typecheck, build, tests unitaires, tests d'intégration contre un vrai PostgreSQL |

### Pourquoi pas Firebase ?

Le brief suggérait d'envisager Firebase pour une solution gratuite. On est resté sur **PostgreSQL + Prisma** parce que :
- Le modèle économique de RailCards a des exigences fortes de **cohérence transactionnelle** (soldes qui ne peuvent jamais être négatifs, un même exemplaire de carte qui ne peut jamais être vendu ou échangé deux fois). Ce sont exactement les garanties qu'apporte une base relationnelle avec transactions ACID et contraintes — bien plus difficiles à obtenir correctement avec un magasin de documents comme Firestore.
- Le stack demandé (NestJS + Prisma) est fullstack TypeScript de bout en bout, ce qui facilite le partage de types entre l'API et le front (`packages/contracts`).
- PostgreSQL et Redis tournent gratuitement en local (Docker Compose fourni) et sur la plupart des hébergeurs avec un palier gratuit (Neon, Supabase, Railway, Render) — voir [docs/deployment.md](docs/deployment.md).

## Démarrage rapide (développement local)

### Prérequis
- Node.js ≥ 20 (testé avec Node 22)
- pnpm (`corepack enable` suffit, la version est épinglée dans `package.json#packageManager`)
- PostgreSQL 16 et Redis 7, soit via Docker (`infrastructure/docker/docker-compose.yml`), soit en local

### Avec Docker Compose (recommandé)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

### Sans Docker (Postgres/Redis déjà installés localement)

```bash
cp .env.example .env
# Adapter DATABASE_URL / REDIS_URL dans .env si besoin
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

`pnpm dev` démarre en parallèle (via Turborepo) :
- l'API NestJS sur http://localhost:4000 (`/api/v1`, doc Swagger sur `/api/docs`)
- le frontend Next.js sur http://localhost:3000
- le worker BullMQ (tâches différées, ex. expiration des échanges)

### Comptes de démonstration (créés par le seed, à ne jamais utiliser en production)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@railcards.local` | `RailCards!Admin2026` |
| Joueur | `jules@railcards.local` | `RailCards!Demo2026` |
| Joueur | `amelie@railcards.local` | `RailCards!Demo2026` |
| Joueur | `theo@railcards.local` | `RailCards!Demo2026` |

L'inscription publique est **sur invitation** par défaut (`INVITE_ONLY_MODE=true`). Un admin génère un code via `POST /api/v1/admin/invitations` (ou l'écran Administration du front).

## Commandes courantes

```bash
pnpm dev                    # démarre api + web + worker en parallèle
pnpm build                  # build tous les packages/apps
pnpm lint                   # ESLint sur tout le monorepo
pnpm typecheck               # tsc --noEmit sur chaque package

pnpm db:migrate              # nouvelle migration Prisma (dev)
pnpm db:migrate:deploy       # applique les migrations existantes (CI/prod)
pnpm db:seed                 # seed idempotent (catalogue, boosters, missions, comptes démo)
pnpm db:studio               # Prisma Studio (explorateur de données)

pnpm test                    # tests unitaires (tous les packages)
pnpm --filter @railcards/api test:integration   # tests d'intégration contre PostgreSQL réel
```

## Structure du monorepo

```
railcards/
  apps/
    web/         Next.js — l'application joueur (+ interface admin)
    api/         NestJS — API REST /api/v1, Swagger, WebSocket (notifications)
    worker/      BullMQ — tâches différées (expiration des échanges, etc.)
  packages/
    ui/          Design system partagé (composants React)
    contracts/   Schémas Zod + types partagés front/API
    game-domain/ Logique métier pure (tirage de boosters, XP, constantes économiques)
    database/    Client Prisma singleton, exporté vers api/worker
  prisma/
    schema.prisma
    migrations/
    seed.ts, seed-data/
  infrastructure/
    docker/      docker-compose.yml (Postgres + Redis pour le dev local)
  docs/
    product/, architecture/, api/
```

## Tests

Voir aussi [docs/architecture/testing.md](docs/architecture/testing.md) pour le détail des 16 scénarios requis et leur statut.

- **Unitaires** (Vitest pour `packages/game-domain`, Jest pour `apps/api`) : logique pure (tirage pondéré de boosters, courbe d'XP, parsing de durée, hachage de token).
- **Intégration** (`apps/api/test/*.e2e-spec.ts`, Jest + Supertest, **exécutés contre un vrai PostgreSQL**, pas des mocks) : inscription/connexion, accès privé sans invitation, bonus de bienvenue unique, ouverture de booster idempotente, insuffisance de solde, création/acceptation d'échange, échec d'échange si carte plus possédée, achat de marché, **deux achats concurrents de la même annonce** (le test lance les deux requêtes en parallèle et vérifie qu'une seule réussit), permissions admin. 23 tests, tous verts au moment de la rédaction.
- **E2E navigateur** (Playwright) : voir `apps/web` — parcours principal inscription → booster de bienvenue → album → marché/échange.

## Documentation

- [docs/architecture/overview.md](docs/architecture/overview.md) — vue d'ensemble technique
- [docs/architecture/data-model.md](docs/architecture/data-model.md) — modèle de données et décisions
- [docs/architecture/environment-variables.md](docs/architecture/environment-variables.md) — variables d'environnement
- [docs/architecture/security.md](docs/architecture/security.md) — mesures de sécurité et risques résiduels
- [docs/api/overview.md](docs/api/overview.md) — vue d'ensemble de l'API REST
- [docs/product/economy.md](docs/product/economy.md) — game design (raretés, boosters, économie)
- [docs/product/known-limitations.md](docs/product/known-limitations.md) — limites connues, honnêtement listées
- [docs/admin-guide.md](docs/admin-guide.md) — guide d'administration
- [docs/deployment.md](docs/deployment.md) — déploiement (Vercel + hébergement API)
- [docs/backup-restore.md](docs/backup-restore.md) — sauvegarde et restauration
- [docs/launch-checklist.md](docs/launch-checklist.md) — checklist avant bêta privée

## Statut du MVP

Voir [docs/launch-checklist.md](docs/launch-checklist.md) pour le détail phase par phase. En résumé : un joueur peut s'inscrire (sur invitation), recevoir son bonus de bienvenue, ouvrir des boosters, voir sa collection/album, échanger des cartes, acheter/vendre sur le marché, accomplir des missions — le tout vérifié par des tests d'intégration contre une vraie base PostgreSQL, y compris les cas de concurrence (double achat, double dépense).
