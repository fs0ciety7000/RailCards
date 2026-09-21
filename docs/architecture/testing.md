# Tests — couverture des scénarios requis

Statut au moment de la rédaction : **23/23 tests d'intégration verts**, **15/15 tests unitaires verts** (7 `packages/game-domain` + 8 `apps/api`). Tous les tests d'intégration tournent contre un **vrai PostgreSQL** local (pas de mock de base de données) — voir `apps/api/test/*.e2e-spec.ts`.

| # | Scénario requis | Où c'est testé | Statut |
|---|---|---|---|
| 1 | Inscription et authentification | `auth.e2e-spec.ts` | ✅ |
| 2 | Accès privé sans invitation | `auth.e2e-spec.ts` (`rejects registration without an invitation code`) | ✅ |
| 3 | Attribution unique de la récompense de bienvenue | `auth.e2e-spec.ts` (`grants … a one-time welcome bonus`, vérifie que se reconnecter ne recrédite pas) + garanti structurellement par la clé d'idempotence `welcome-bonus-${userId}` dans `AuthService.register` | ✅ |
| 4 | Ouverture d'un booster avec débit et attribution | `boosters.e2e-spec.ts` (`opens a booster, debits the wallet, and grants cards…`) | ✅ |
| 5 | Répétition d'une requête idempotente | `boosters.e2e-spec.ts` (`is idempotent: repeating the same Idempotency-Key…`) | ✅ |
| 6 | Impossibilité de dépenser un solde insuffisant | `boosters.e2e-spec.ts` (`rejects opening a booster once the balance is insufficient…`) + `wallet.e2e-spec.ts` | ✅ |
| 7 | Impossibilité de modifier le tirage côté client | `boosters.e2e-spec.ts` (`ignores any client-supplied fields…`, whitelist DTO rejette tout champ inconnu) + structurellement : l'endpoint n'accepte que `{ boosterSlug }`, le tirage est calculé côté serveur (`packages/game-domain`) | ✅ |
| 8 | Création d'un échange | `trades.e2e-spec.ts` | ✅ |
| 9 | Acceptation d'un échange valide | `trades.e2e-spec.ts` | ✅ |
| 10 | Échec d'un échange si une carte n'appartient plus au joueur | `trades.e2e-spec.ts` (double-spend guard via l'état `RESERVED_TRADE`) | ✅ |
| 11 | Achat d'une annonce | `market.e2e-spec.ts` | ✅ |
| 12 | Deux achats concurrents d'une même annonce | `market.e2e-spec.ts` (`Promise.all` de deux requêtes réelles en parallèle) | ✅ |
| 13 | Absence de double transfert | `market.e2e-spec.ts` (même test que 12 : exactement un des deux acheteurs possède la carte à la fin) | ✅ |
| 14 | Absence de solde négatif | `wallet.e2e-spec.ts` + garanti par la contrainte SQL `CHECK (balance >= 0)` | ✅ |
| 15 | Contrôle des permissions admin | `admin.e2e-spec.ts` | ✅ |
| 16 | Affichage responsive des parcours principaux | Playwright, `apps/web` (voir le rapport du frontend) | Voir le statut du frontend |

## Exécuter les tests

```bash
# Unitaires — logique pure, aucune base de données requise
pnpm test

# Intégration — nécessite PostgreSQL + Redis actifs, la base de test seedée
pnpm --filter @railcards/database prisma:migrate:deploy   # une fois
DATABASE_URL=... pnpm --filter @railcards/database prisma:seed  # une fois, cible la base de test
pnpm --filter @railcards/api test:integration
```

En local, `apps/api/.env.test` pointe vers une base séparée (`railcards_test`) pour ne jamais polluer les données de développement. En CI, chaque run utilise un conteneur PostgreSQL/Redis éphémère (voir `.github/workflows/ci.yml`).

## Pourquoi Jest pour l'API et Vitest pour les packages

NestJS fournit `@nestjs/testing` avec une intégration Jest de référence (`Test.createTestingModule`) — s'en écarter aurait ajouté de la friction sans bénéfice. Les packages purs (`game-domain`) n'ont aucune dépendance à NestJS et utilisent Vitest, plus rapide au démarrage pour de la logique pure.

## Limite connue

Il n'y a pas encore de test de charge/perf dédié, ni de test de résilience réseau (coupure Postgres en cours de transaction, par exemple). Le comportement attendu (rollback automatique d'une transaction Prisma interactive si la connexion tombe) n'est pas vérifié explicitement par un test.
