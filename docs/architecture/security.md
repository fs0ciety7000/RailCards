# Sécurité

## Principe directeur

Le serveur est l'autorité absolue sur : les tirages de boosters, les soldes, les récompenses, les droits de propriété des cartes, les échanges, les achats. **Aucune valeur envoyée par le client** (`ownerId`, prix, rareté, résultat de tirage) n'est jamais utilisée telle quelle pour une décision économique ou de propriété — voir [overview.md](overview.md#autorité-serveur).

## Authentification

- Mots de passe hachés avec **bcrypt** (12 rounds), jamais stockés ni journalisés en clair.
- Jeton d'accès **JWT** courte durée (15 min par défaut), signé avec un secret dédié, transmis en `Authorization: Bearer`. Il n'est jamais stocké dans un cookie ni dans `localStorage` côté client recommandé (voir le frontend) — il vit en mémoire JS et est perdu au rechargement, ce qui limite la fenêtre d'exposition en cas de XSS.
- Session de **refresh opaque** : un jeton aléatoire haute entropie (48 octets, `crypto.randomBytes`) est haché en SHA-256 avant stockage (`Session.refreshTokenHash`) — jamais le jeton en clair en base. Il est transmis via un cookie `httpOnly`, `SameSite=Strict`, `Secure` en production, **scopé au chemin** `/api/v1/auth` (donc jamais envoyé sur les autres routes, ce qui limite la surface CSRF).
- **Rotation de refresh token** : chaque `/auth/refresh` révoque la session utilisée et en émet une nouvelle. Si un jeton déjà révoqué est présenté à nouveau (signe probable de vol/rejeu), **toutes** les sessions de l'utilisateur sont révoquées par précaution.
- La suspension d'un compte par un admin révoque immédiatement toutes ses sessions actives.
- Pas de dépendance à un fournisseur d'authentification tiers payant : l'implémentation ci-dessus (JWT + Passport + bcrypt) est un standard éprouvé, maintenu, et gratuit.

## Autorisation

- Un garde JWT global (`JwtAuthGuard`) protège **par défaut** toute route ; seules les routes explicitement annotées `@Public()` (santé, inscription, connexion, refresh, déconnexion) sont accessibles sans jeton.
- Un garde de rôle (`RolesGuard` + `@Roles('ADMIN')`) protège tout le contrôleur `admin`. **Aucune route n'accepte de champ `role` en entrée** — le rôle ne peut être changé que directement en base ou (à construire) par un processus d'administration hors bande. Voir [admin-guide.md](../admin-guide.md).
- Chaque opération sur une ressource (annuler une annonce, accepter un échange, etc.) revérifie l'identité du demandeur par rapport au propriétaire réel en base — jamais seulement par rapport à un identifiant fourni dans l'URL.

## Concurrence et intégrité économique

Le mécanisme central, utilisé partout (portefeuille, marché, échanges, boosters) : des **mises à jour conditionnelles** (`updateMany({ where: { id, <condition d'état actuel> }, data: { <nouvel état> } })`) à l'intérieur d'une transaction Prisma interactive, en vérifiant que `count === 1`. PostgreSQL sérialise nativement deux écritures concurrentes sur la même ligne (la seconde transaction attend, puis reréévalue sa clause `WHERE` après le commit de la première) — c'est ce qui garantit, sans verrou explicite ni file d'attente applicative, que :
- deux achats simultanés de la même annonce ne peuvent pas tous les deux réussir (**vérifié par un test d'intégration qui lance réellement deux requêtes en parallèle contre PostgreSQL**, voir `apps/api/test/market.e2e-spec.ts`) ;
- un débit de portefeuille ne peut jamais faire passer le solde sous zéro, même si deux débits concurrents sont tentés sur un solde tout juste suffisant pour un seul des deux ;
- l'acceptation d'un échange revalide, carte par carte, que l'expéditeur possède toujours chaque exemplaire offert et que le destinataire possède toujours chaque exemplaire demandé — sinon toute la transaction est annulée (aucun transfert partiel).
- l'ouverture d'un booster est idempotente via une clé unique (`Idempotency-Key` fournie par le client + `userId` + `boosterSlug`) : rejouer la même requête (retry réseau) renvoie le résultat déjà produit au lieu de débiter ou tirer une seconde fois.

## Validation des entrées

- Toutes les routes utilisent des DTOs `class-validator` avec un `ValidationPipe` global configuré en **whitelist stricte** (`forbidNonWhitelisted: true`) : un champ non déclaré dans le DTO fait échouer la requête plutôt que d'être silencieusement ignoré ou pire, accepté.
- Les identifiants (UUID), montants (entiers positifs bornés), noms d'utilisateur (regex) sont validés au niveau du type, pas seulement au niveau applicatif.

## Rate limiting

Un `ThrottlerGuard` global limite chaque IP à 300 requêtes par minute sur l'ensemble de l'API. C'est une protection basique anti-abus pour le MVP — voir les limites connues ci-dessous.

## En-têtes et transport

- `helmet()` appliqué globalement (en-têtes de sécurité standards : `X-Content-Type-Options`, etc.).
- CORS restreint à l'origine du frontend (`WEB_BASE_URL`), avec `credentials: true` (nécessaire pour le cookie de refresh).
- Le serveur ne doit être exposé qu'en HTTPS en production (géré par l'hébergeur, voir [deployment.md](../deployment.md)) — le flag `secure` du cookie de refresh se base sur `NODE_ENV=production`.

## Gestion des erreurs

Un filtre d'exception global (`AllExceptionsFilter`) normalise toute erreur non prévue en `{ statusCode: 500, message: "Internal server error" }` — jamais de stack trace, de message Prisma brut ou de détail interne renvoyé au client. Les erreurs Prisma connues (contrainte unique, ressource introuvable) sont traduites en codes HTTP appropriés (409, 404) avec un message générique.

## Journalisation

`AuditLog` enregistre chaque action d'administration (création/modification de carte, publication de booster, suspension de compte, résolution de signalement…) avec l'identité de l'acteur, la cible et un horodatage — consultable via `GET /admin/audit-log`. Aucune donnée sensible (mot de passe, jeton) n'est jamais journalisée.

## ⚠️ Risques résiduels et limites connues (honnêteté requise par le brief)

Ce projet **n'est pas invulnérable**. Limites connues à ce stade du MVP, documentées plutôt que cachées :

1. **Pas de vérification d'email réelle branchée** — `emailVerifiedAt` existe dans le schéma mais aucun fournisseur SMTP n'est configuré par défaut ; en développement les emails « d'envoi » ne sont pas réellement envoyés. Un attaquant pourrait donc s'inscrire avec un email qu'il ne contrôle pas tant qu'un fournisseur email n'est pas branché (voir `SMTP_*` dans `.env.example`).
2. **Rate limiting basique** (300 req/min/IP global) — pas de limite spécifique par endpoint sensible (ex. tentatives de connexion), ce qui laisse une fenêtre pour du bruteforce lent. À durcir avant l'ouverture publique (limite dédiée sur `/auth/login`, verrouillage progressif).
3. **Pas de CSRF token explicite** — la protection actuelle repose sur `SameSite=Strict` + le scoping du cookie de refresh au chemin `/api/v1/auth` + l'absence de cookie sur les routes mutantes (elles utilisent le Bearer token, pas de cookie, donc pas de surface CSRF classique). C'est une protection raisonnable mais pas testée en profondeur (pas de test dédié CSRF).
4. **Presence/notifications temps réel en mémoire** (`RealtimeGateway`) — ne fonctionne correctement qu'avec une seule instance API. Passer à plusieurs instances nécessite un adaptateur Redis pour Socket.IO (non branché).
5. **Numérotation de série (`CardInstance.serialNumber`) non strictement séquentielle sous forte concurrence** — calculée par un `count()` avant insertion plutôt que par une séquence atomique dédiée. Aucune contrainte d'unicité ne dépend de ce numéro (il est purement cosmétique/collector), donc aucune garantie économique n'est affectée, mais deux ouvertures simultanées de la même carte pourraient exceptionnellement obtenir le même numéro de série affiché.
6. **Pas d'audit de sécurité externe** — ce code n'a pas été revu par un tiers ni testé par un pentest. Les mécanismes ci-dessus suivent des pratiques standards mais n'offrent aucune garantie formelle.
7. **Object storage (S3) non branché** — les images utilisent des placeholders servis statiquement par le frontend ; le champ `imageUrl` est prêt à recevoir de vraies URL S3/CDN quand un fournisseur sera configuré.
