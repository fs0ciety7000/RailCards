# Variables d'environnement

Référence complète : [`.env.example`](../../.env.example) (à la racine, sans secret réel). Copiez-le en `.env` puis distribuez les valeurs pertinentes vers `apps/api/.env` et `apps/web/.env.local` selon votre méthode de déploiement (le repo actuel copie simplement le `.env` racine dans `apps/api/.env` pour le développement local).

| Variable | Utilisée par | Description |
|---|---|---|
| `DATABASE_URL` | api, worker, prisma CLI | Chaîne de connexion PostgreSQL |
| `REDIS_URL` | api (WebSocket/rate limit futur), worker (BullMQ) | Chaîne de connexion Redis |
| `API_PORT` | api | Port d'écoute HTTP (défaut 4000) |
| `API_BASE_URL` | api, docs | URL publique de l'API |
| `WEB_BASE_URL` | api (CORS) | URL publique du frontend, utilisée pour la politique CORS |
| `NODE_ENV` | api | `development` \| `test` \| `production` — contrôle entre autres le flag `secure` des cookies |
| `JWT_ACCESS_SECRET` | api | Secret de signature du jeton d'accès (courte durée) |
| `JWT_REFRESH_SECRET` | api | Réservé pour une éventuelle évolution vers un refresh JWT signé ; le refresh actuel est un jeton opaque haché en base (voir [security.md](security.md)) |
| `JWT_ACCESS_TTL` | api | Durée de vie du jeton d'accès (ex. `15m`) |
| `JWT_REFRESH_TTL` | api | Durée de vie de la session de refresh (ex. `30d`) |
| `COOKIE_SECRET` | api | Réservé pour la signature de cookies additionnels |
| `INVITE_ONLY_MODE` | api | `true`/`false` — active la bêta privée sur invitation |
| `TRADE_CR_ENABLED` | api (frontend, à terme) | Autorise ou non l'ajout de CR dans une proposition d'échange |
| `MARKET_FEE_BPS` | api | Commission du marché en points de base (500 = 5 %), figée sur chaque annonce à sa création |
| `S3_*` | api (stockage objet, non branché dans le MVP) | Voir [known-limitations.md](../product/known-limitations.md) |
| `SMTP_*`, `EMAIL_FROM` | api (email, non branché dans le MVP) | Idem |
| `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` | api (observabilité, préparé mais non activé) | Voir [security.md](security.md) |
| `NEXT_PUBLIC_API_BASE_URL` | web | URL de base de l'API côté client (doit inclure `/api/v1`) |

## Secrets en production

Ne jamais committer de vraies valeurs. En production, générez des secrets aléatoires forts, par exemple :

```bash
openssl rand -base64 48
```

et injectez-les via les variables d'environnement de votre hébergeur (jamais dans un fichier versionné).
