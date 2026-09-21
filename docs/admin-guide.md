# Guide d'administration

## Accès

Connectez-vous avec un compte dont le rôle est `ADMIN` (le seed en crée un : `admin@railcards.local` / `RailCards!Admin2026`, **à changer avant toute mise en production**). Aucune route ne permet à un utilisateur ordinaire de s'attribuer le rôle admin — voir [Créer un administrateur](#créer-un-administrateur-supplémentaire) ci-dessous pour la procédure sûre.

## Ce que peut faire un administrateur

Toutes ces actions sont accessibles via l'écran **Administration** du frontend (visible uniquement pour un compte `ADMIN`) et via l'API sous `/api/v1/admin/*` (voir [docs/api/overview.md](api/overview.md)) :

- **Catalogue** : créer/modifier une série, créer/modifier une carte, la publier (`DRAFT → PUBLISHED`) ou l'archiver (`→ ARCHIVED`). Une carte non publiée n'apparaît jamais dans le catalogue joueur ni dans les pools de boosters.
- **Boosters** : créer une définition de booster, publier une nouvelle version de pool de probabilités (`POST /admin/boosters/:id/pool`) — republier des poids ne modifie jamais l'historique des ouvertures passées (chaque ouverture reste liée à la version qui l'a produite).
- **Invitations** : générer un code d'invitation (usage unique par défaut, `maxUses` et `expiresInDays` configurables), consulter la liste des invitations émises et leur statut d'utilisation.
- **Comptes joueurs** : rechercher un compte, le suspendre (révoque immédiatement toutes ses sessions actives) ou le réactiver. Un admin ne peut pas se suspendre lui-même.
- **Signalements** : consulter les signalements ouverts, les marquer résolus ou rejetés.
- **Transactions et audit** : consulter en lecture seule le journal des mouvements de portefeuille, l'historique des transactions du marché, et le journal d'audit (qui a fait quoi, quand).

## Créer un administrateur supplémentaire

Il n'existe volontairement **aucun endpoint API** pour promouvoir un utilisateur en admin (surface d'attaque nulle). Pour créer un second compte admin :

```bash
# Ouvrir Prisma Studio (interface graphique sur la base)
pnpm db:studio
# → table User → trouver le compte → champ `role` → ADMIN
```

ou en une commande :

```bash
cd packages/database
DATABASE_URL="..." npx prisma studio
```

En production, restreignez l'accès à la base de données elle-même (réseau privé, pas d'accès public) — c'est la vraie garde-barrière pour cette opération sensible.

## Configuration du jeu

- **Mode invitation** : `INVITE_ONLY_MODE=true|false` dans les variables d'environnement de l'API. Désactiver ouvre l'inscription à tous (l'ouverture publique prévue après la bêta).
- **Commission du marché** : `MARKET_FEE_BPS` (points de base, 500 = 5 %) — ne s'applique qu'aux **nouvelles** annonces (chaque annonce fige son taux à sa création, donc changer la variable ne modifie jamais rétroactivement une annonce déjà publiée).
- **Échanges en CR** : `TRADE_CR_ENABLED` — active/désactive la possibilité d'ajouter des CR dans une proposition d'échange.

## Bonnes pratiques

- Changez immédiatement le mot de passe du compte admin seedé avant tout déploiement au-delà du développement local.
- Ne partagez jamais un jeton d'accès admin ; il expire de toute façon en 15 minutes.
- Consultez régulièrement `/admin/audit-log` pour repérer une activité admin inattendue.
