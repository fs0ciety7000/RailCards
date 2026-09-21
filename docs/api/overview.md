# API — vue d'ensemble

Documentation interactive complète (générée automatiquement, toujours à jour avec le code) : lancez l'API puis ouvrez **http://localhost:4000/api/docs** (Swagger UI). Ce document donne les conventions transversales ; pour le détail exact d'une requête/réponse, se référer à Swagger ou au contrôleur correspondant dans `apps/api/src/*/*.controller.ts`.

## Base URL et versionnage

Toutes les routes sont préfixées `/api/v1`. Le versionnage par URI est géré nativement par NestJS (`app.enableVersioning`) — une v2 pourrait coexister sans casser les clients existants.

## Authentification

- `Authorization: Bearer <accessToken>` sur toute route protégée (par défaut, toutes, sauf `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/health`).
- Le jeton d'accès est retourné dans le **corps** de la réponse de `/auth/register` et `/auth/login` — à garder en mémoire côté client, pas en `localStorage`.
- Le jeton de refresh est un **cookie httpOnly** posé automatiquement par le serveur, jamais accessible en JavaScript. `POST /auth/refresh` (avec `credentials: 'include'`) échange ce cookie contre un nouveau jeton d'accès.

## Pagination

Les listes paginées suivent toutes la même forme :

```json
{ "items": [ … ], "page": 1, "pageSize": 20, "total": 53, "totalPages": 3 }
```

via les query params `?page=&pageSize=` (bornes appliquées côté serveur, `pageSize` max 100).

## Forme des erreurs

```json
{ "statusCode": 400, "message": "Insufficient Crédits Rail balance: required 120, available 60", "error": "Bad Request" }
```

Pour les erreurs de validation, `message` peut être un tableau de chaînes (une par champ invalide) plutôt qu'une chaîne unique.

## En-tête d'idempotence

`POST /boosters/open` **exige** un en-tête `Idempotency-Key` (n'importe quelle chaîne unique côté client, typiquement un UUID généré par requête d'ouverture). Rejouer la même clé renvoie le résultat déjà produit — utile pour un retry réseau sans double débit ni double tirage.

## Endpoints principaux (groupés par domaine)

| Domaine | Exemples de routes |
|---|---|
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all` |
| Utilisateurs | `GET /me`, `GET /users/:username` |
| Catalogue | `GET /rarities`, `/series`, `/cards`, `/cards/:id` |
| Collection | `GET /collection`, `/collection/album`, `/collection/:instanceId` |
| Portefeuille | `GET /wallet`, `/wallet/transactions`, `GET`/`POST /wallet/daily-reward(/claim)` |
| Boosters | `GET /boosters`, `/boosters/history`, `POST /boosters/open` |
| Missions | `GET /missions`, `POST /missions/:id/claim`, `GET /achievements`, `POST /achievements/:id/claim` |
| Échanges | `POST /trades`, `GET /trades`, `/trades/:id`, `POST /trades/:id/accept|reject|cancel` |
| Marché | `GET /market/listings`, `/market/listings/:id`, `POST /market/listings`, `/market/listings/:id/buy`, `DELETE /market/listings/:id` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `/notifications/read-all` |
| Signalement | `POST /reports` |
| Administration | `GET/POST /admin/series`, `/admin/cards`, `/admin/boosters`, `/admin/invitations`, `/admin/users`, `/admin/reports`, lecture `/admin/wallet-transactions`, `/admin/market-transactions`, `/admin/audit-log` — tout sous rôle `ADMIN` |

## Temps réel (optionnel)

`Socket.IO`, namespace `/realtime`, authentifié via `{ auth: { token: accessToken } }` au handshake. Événement `notification` émis à l'utilisateur concerné (échange reçu/accepté, vente réalisée, etc.). Le polling REST (`GET /notifications`) reste toujours disponible comme repli — le WebSocket n'est qu'un confort, jamais une source de vérité (voir [architecture/security.md](../architecture/security.md) pour la limite multi-instance).
