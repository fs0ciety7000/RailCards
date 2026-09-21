# Déploiement

## Décision produit : pourquoi l'API n'est pas sur Vercel

Le brief demande un hébergement sur Vercel. C'est le bon choix pour **`apps/web`** (Next.js — c'est littéralement ce pour quoi Vercel est conçu, palier gratuit généreux). Ce n'est en revanche **pas adapté à `apps/api`** telle qu'elle est construite, pour deux raisons concrètes :

1. **Connexions PostgreSQL persistantes** : Prisma maintient un pool de connexions ; les fonctions serverless de Vercel démarrent et s'arrêtent en permanence, ce qui multiplie les connexions ouvertes vers Postgres et épuise rapidement la limite de connexions d'un palier gratuit (Neon/Supabase la limitent explicitement pour cette raison).
2. **WebSocket (Socket.IO)** : les fonctions serverless Vercel ne maintiennent pas de connexion longue durée — les notifications temps réel ne fonctionneraient simplement pas.

Réécrire l'API en fonctions serverless (Next.js API routes) casserait la structure modulaire NestJS et le temps réel pour un gain (« tout sur Vercel ») plus symbolique que réel. La solution retenue, gratuite et éprouvée :

| Composant | Hébergement recommandé (palier gratuit) | Pourquoi |
|---|---|---|
| `apps/web` (Next.js) | **Vercel** | Conforme au brief, c'est son usage prévu |
| `apps/api` (NestJS) | Railway, Render ou Fly.io (palier gratuit/hobby) | Processus long-vivant, WebSocket natif, pool de connexions stable |
| `apps/worker` | Même hébergeur que l'API (souvent un second service dans le même projet) | Doit tourner en continu à côté de l'API |
| PostgreSQL | Neon ou Supabase (palier gratuit) | Postgres managé gratuit, migrations Prisma standards |
| Redis | Upstash (palier gratuit, HTTP/TCP) | Compatible BullMQ, gratuit |

Si le déploiement doit **absolument** rester à 100 % sur Vercel : c'est possible en renonçant au WebSocket (repli sur le polling REST, déjà implémenté comme solution de secours — voir [docs/api/overview.md](api/overview.md#temps-réel-optionnel)) et en utilisant impérativement un Postgres "serverless-friendly" avec pooling externe (ex. Neon avec son pooler intégré, ou Prisma Accelerate). Ce document ne détaille pas cette variante car elle n'a pas été testée dans ce projet — la recommandation ci-dessus est celle qui a été validée.

## Étapes de déploiement

### 1. Base de données (Neon/Supabase)

```bash
# Récupérer la DATABASE_URL fournie par l'hébergeur, puis :
pnpm --filter @railcards/database prisma:migrate:deploy
pnpm --filter @railcards/database prisma:seed   # uniquement pour peupler un environnement de démo/staging
```

Ne lancez **jamais** `prisma:seed` sur une base de production réelle une fois que de vrais joueurs existent — le seed est idempotent sur le catalogue mais recréerait les comptes démo.

### 2. Redis (Upstash)

Récupérer l'URL de connexion, la placer dans `REDIS_URL` pour l'API et le worker.

### 3. API (Railway/Render/Fly.io)

- Build : `pnpm install --frozen-lockfile && pnpm --filter @railcards/database prisma:generate && pnpm --filter @railcards/api build`
- Start : `node apps/api/dist/main.js`
- Variables d'environnement : toutes celles listées dans [`.env.example`](../.env.example), avec des secrets régénérés (`openssl rand -base64 48`) — jamais les valeurs de développement.
- `WEB_BASE_URL` doit pointer vers le domaine Vercel définitif (CORS).
- `NODE_ENV=production` (active le flag `secure` sur le cookie de refresh — nécessite HTTPS, fourni nativement par ces hébergeurs).

### 4. Worker (même hébergeur que l'API)

- Build : identique à l'API mais `pnpm --filter @railcards/worker build`
- Start : `node apps/worker/dist/index.js`
- Mêmes variables `DATABASE_URL`/`REDIS_URL` que l'API.

### 5. Frontend (Vercel)

- Root directory du projet Vercel : `apps/web`
- Build command : laisser Vercel détecter Next.js (ou `pnpm --filter @railcards/web build` si le monorepo n'est pas auto-détecté)
- Variable d'environnement : `NEXT_PUBLIC_API_BASE_URL=https://<votre-domaine-api>/api/v1`

### 6. Vérification post-déploiement

```bash
curl https://<votre-domaine-api>/api/v1/health
# → {"status":"ok","timestamp":"..."}
```

Puis parcourir le parcours principal en production : inscription (avec un code d'invitation généré par un admin) → booster → collection → marché/échange.

## CI/CD

`.github/workflows/ci.yml` fait tourner lint, typecheck, build, tests unitaires et tests d'intégration (contre un PostgreSQL/Redis éphémère) sur chaque push/PR. Le déploiement effectif (push vers Railway/Vercel) n'est pas automatisé dans ce dépôt — à brancher via les intégrations natives de chaque hébergeur (déploiement automatique sur push vers `main`, standard chez Vercel/Railway) une fois l'environnement de production choisi.
