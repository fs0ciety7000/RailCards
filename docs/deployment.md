# Déploiement

RailCards est déployé sur **Coolify**, en auto-hébergé, à partir du
`docker-compose.yml` à la racine du dépôt. Ce document décrit cette
configuration. Une alternative 100 % plateformes managées (Vercel + Railway)
est documentée en fin de fichier pour référence, mais n'est pas celle
utilisée en production.

## Architecture du déploiement

Le `docker-compose.yml` racine définit 5 services :

| Service | Rôle | Domaine public |
|---|---|---|
| `web` | Next.js (`apps/web`), image standalone | `railcards.fs0ciety.org` |
| `api` | NestJS (`apps/api`) — REST + WebSocket | `railcards-api.fs0ciety.org` |
| `worker` | BullMQ (`apps/worker`) — purge des échanges expirés | aucun (interne) |
| `postgres` | PostgreSQL 16 | aucun (interne) |
| `redis` | Redis 7 | aucun (interne) |

**Sous-domaines à un seul niveau, toujours** — `railcards-api.fs0ciety.org`,
pas `api.railcards.fs0ciety.org`. Le certificat Universal SSL gratuit de
Cloudflare ne couvre qu'un seul niveau de sous-domaine sous l'apex
(`*.fs0ciety.org`) ; un deuxième niveau (`api.railcards.fs0ciety.org`)
échoue au handshake TLS (`SSL handshake failure`) tant que Cloudflare
« Total TLS » n'est pas activé pour cette zone. Même convention que les
autres projets sur cette instance (`db.fs0ciety.org`, `blog.fs0ciety.org`,
etc.).

Chaque app (`web`, `api`, `worker`) a son propre `Dockerfile` multi-stage
(`apps/*/Dockerfile`), construit avec la **racine du dépôt comme contexte de
build** (nécessaire pour résoudre les packages du workspace pnpm —
`@railcards/ui`, `@railcards/database`, etc.). Le build utilise
`turbo prune --docker` pour ne récupérer que le sous-ensemble du monorepo
réellement nécessaire à chaque app.

`web` est pourquoi son propre domaine et pas juste un proxy vers `api` :
le frontend appelle l'API **directement depuis le navigateur** (REST +
WebSocket temps réel), pas via le serveur Next.js — voir
`NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_WS_URL` ci-dessous.

### Migrations Prisma

Aucun conteneur ni étape de build séparée pour les migrations : le conteneur
`api` exécute `prisma migrate deploy` **à chaque démarrage**, avant de
lancer le serveur (voir `apps/api/docker-entrypoint.sh`). C'est idempotent —
sans migration en attente, l'étape est un no-op de quelques centaines de
millisecondes — donc chaque redéploiement applique automatiquement le
schéma à jour, sans étape manuelle.

`worker` attend que `api` soit `healthy` (`depends_on: condition:
service_healthy`, basé sur le `HEALTHCHECK` de l'image `api` qui appelle
`/api/v1/health`) avant de démarrer, pour ne jamais lire une base dont le
schéma n'est pas encore à jour.

## Étapes de déploiement (Coolify)

### 1. Pointer le domaine

Ajoutez les enregistrements DNS pour `railcards.fs0ciety.org` et
`railcards-api.fs0ciety.org` (CNAME proxié vers `fs0ciety.org`, comme vos
autres sous-domaines) vers votre instance Coolify. Voir l'encadré ci-dessus
sur pourquoi ce sont bien des sous-domaines à un seul niveau.

### 2. Créer la ressource dans Coolify

- **New Resource → Docker Compose** (pas "Application" simple — le repo
  contient plusieurs services).
- Connectez le dépôt `fs0ciety7000/railcards`, branche de production
  (généralement `main` — pas une branche de développement Claude).
- **Base Directory** : `/` (racine du dépôt).
- **Docker Compose Location** : `docker-compose.yml`.

### 3. Variables d'environnement

Dans l'onglet *Environment Variables* de la ressource Coolify, définissez
(valeurs de dev à **ne jamais** réutiliser — régénérez les secrets avec
`openssl rand -base64 48`) :

| Variable | Exemple / note |
|---|---|
| `POSTGRES_PASSWORD` | secret généré |
| `JWT_ACCESS_SECRET` | secret généré |
| `JWT_REFRESH_SECRET` | secret généré |
| `COOKIE_SECRET` | secret généré |
| `WEB_BASE_URL` | `https://railcards.fs0ciety.org` |
| `API_BASE_URL` | `https://railcards-api.fs0ciety.org` (sans `/api/v1` — utilisée pour construire les URLs absolues des images uploadées) |
| `NEXT_PUBLIC_API_BASE_URL` | `https://railcards-api.fs0ciety.org/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `https://railcards-api.fs0ciety.org` |
| `INVITE_ONLY_MODE` | `true` (garde le jeu fermé tant que non annoncé) |

Toutes les autres variables de [`.env.example`](../.env.example) ont des
valeurs par défaut raisonnables dans `docker-compose.yml` (S3/SMTP/Sentry —
vides = fonctionnalités correspondantes désactivées, cf.
[`docs/product/known-limitations.md`](product/known-limitations.md)).

**Important** : `NEXT_PUBLIC_API_BASE_URL` et `NEXT_PUBLIC_WS_URL` sont
compilées **en dur dans le bundle client** par `next build` (voir
`apps/web/Dockerfile`, `ARG`/`ENV`) — Coolify doit les exposer comme
variables au moment du **build**, pas seulement à l'exécution. Sur les
versions récentes de Coolify, les variables d'environnement de la ressource
sont automatiquement disponibles au build ; si un déploiement montre encore
l'ancienne valeur dans le bundle après un changement, forcez un rebuild
complet (pas juste un restart).

### 4. Domaines

Dans l'onglet *Domains* de la ressource :

- Service `web`, port `3000` → `https://railcards.fs0ciety.org`
- Service `api`, port `4000` → `https://railcards-api.fs0ciety.org`

Ne pas assigner de domaine à `worker`, `postgres` ou `redis` : ils n'ont pas
de port HTTP à exposer et ne doivent jamais être accessibles publiquement
(pas de labels Traefik dans `docker-compose.yml` pour ces services non plus
— cf. commentaires dans le fichier).

### 5. Premier déploiement

Lancez le déploiement depuis Coolify. Au premier build, `postgres` démarre
avec une base vide ; le conteneur `api` applique les 3 migrations Prisma au
démarrage (voir logs du conteneur `api` : `[api] applying pending Prisma
migrations...`). Aucune donnée n'existe encore — catalogue, comptes admin,
etc. doivent être seedés manuellement (étape suivante).

### 6. Peupler le catalogue (une seule fois)

Depuis l'onglet *Terminal* de Coolify sur le conteneur `api` (ou `docker
compose exec api sh` si vous avez un accès SSH au serveur) :

```bash
pnpm --filter @railcards/database prisma:seed
```

Le seed est idempotent sur le catalogue (raretés, séries, cartes, boosters,
missions) — le relancer ne duplique rien. Il crée aussi un compte admin et
un compte démo : **ne le relancez jamais après que de vrais joueurs se
soient inscrits**, il recréerait ces comptes de test.

### 7. Vérification post-déploiement

```bash
curl https://railcards-api.fs0ciety.org/api/v1/health
# → {"status":"ok","timestamp":"..."}
```

Puis parcourir le parcours principal en production : inscription (avec un
code d'invitation généré par le compte admin seedé) → booster → collection
→ marché/échange.

### 8. Redéploiements suivants

Un `git push` sur la branche de production déclenche un rebuild Coolify
(webhook GitHub, à activer dans l'onglet *Webhooks* si ce n'est pas déjà le
cas). Chaque redéploiement reconstruit les 3 images, puis le conteneur
`api` applique automatiquement les migrations en attente avant de démarrer
— aucune étape manuelle nécessaire pour un schéma qui évolue.

## Limites connues de cette configuration

- Les images `api` et `worker` embarquent l'arbre pnpm complet (avec
  devDependencies) plutôt qu'un `node_modules` réduit aux seules
  dépendances de production — plus simple et plus robuste face aux
  subtilités des symlinks pnpm dans un monorepo, au prix d'images plus
  grosses que le minimum théorique. `web` utilise en revanche la sortie
  `standalone` de Next.js (image nettement plus légère).
- `postgres`/`redis` tournent comme conteneurs du même stack Compose plutôt
  que comme ressources managées Coolify dédiées — cohérent avec les autres
  projets déployés sur cette instance. Migrer vers des ressources managées
  Coolify (ou un Postgres externe) reste possible sans changer le code
  applicatif : il suffit de pointer `DATABASE_URL`/`REDIS_URL` ailleurs et
  de retirer les services `postgres`/`redis` du compose.
- **Images uploadées (cartes/boosters) sur disque local** (`railcards_uploads_data`,
  monté sur `/app/storage` du conteneur `api`) plutôt que sur un stockage
  S3-compatible — cohérent avec le reste de cette configuration à instance
  unique. Ça ne fonctionnerait pas tel quel avec plusieurs réplicas de `api`
  (chacun verrait un disque différent) ; passer à S3 (déjà prévu dans
  `apps/api/src/storage/storage.service.ts`, juste pas branché) serait
  nécessaire avant de scaler horizontalement l'API.

## Alternative : plateformes managées (Vercel + Railway/Render/Fly.io)

Cette section documente une alternative évaluée mais **non utilisée en
production** — conservée pour référence si l'hébergement devait un jour
changer.

Le brief d'origine demandait un hébergement sur Vercel. C'est le bon choix
pour **`apps/web`** (Next.js — c'est littéralement ce pour quoi Vercel est
conçu). Ce n'est en revanche **pas adapté à `apps/api`** telle qu'elle est
construite, pour deux raisons concrètes :

1. **Connexions PostgreSQL persistantes** : Prisma maintient un pool de
   connexions ; les fonctions serverless de Vercel démarrent et s'arrêtent
   en permanence, ce qui multiplie les connexions ouvertes vers Postgres et
   épuise rapidement la limite de connexions d'un palier gratuit
   (Neon/Supabase la limitent explicitement pour cette raison).
2. **WebSocket (Socket.IO)** : les fonctions serverless Vercel ne
   maintiennent pas de connexion longue durée — les notifications temps
   réel ne fonctionneraient simplement pas.

| Composant | Hébergement (palier gratuit) | Pourquoi |
|---|---|---|
| `apps/web` (Next.js) | Vercel | Conforme au brief, c'est son usage prévu |
| `apps/api` (NestJS) | Railway, Render ou Fly.io | Processus long-vivant, WebSocket natif |
| `apps/worker` | Même hébergeur que l'API | Doit tourner en continu à côté de l'API |
| PostgreSQL | Neon ou Supabase | Postgres managé gratuit |
| Redis | Upstash | Compatible BullMQ, gratuit |

Étapes (si cette voie était retenue) :

1. **Base de données** : `pnpm --filter @railcards/database prisma:migrate:deploy`, puis (staging/démo uniquement) `prisma:seed`.
2. **Redis** : récupérer l'URL Upstash, la placer dans `REDIS_URL`.
3. **API** — build : `pnpm install --frozen-lockfile && pnpm --filter @railcards/database prisma:generate && pnpm --filter @railcards/api build` ; start : `node apps/api/dist/main.js`.
4. **Worker** — build identique mais `--filter @railcards/worker` ; start : `node apps/worker/dist/index.js`.
5. **Frontend (Vercel)** — root directory `apps/web` ; `NEXT_PUBLIC_API_BASE_URL=https://<domaine-api>/api/v1`.

## CI/CD

`.github/workflows/ci.yml` fait tourner lint, typecheck, build, tests
unitaires, tests d'intégration (contre un PostgreSQL/Redis éphémère) et
tests E2E Playwright sur chaque push/PR — indépendamment du déploiement
Coolify décrit ci-dessus.
