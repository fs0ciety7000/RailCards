# Game design & économie

## Raretés

Six paliers, définis en base (table `Rarity`, éditable par un admin) et seedés avec ces valeurs par défaut :

| Rareté | Poids de tirage par défaut (/1000) | Probabilité approx. |
|---|---|---|
| Commune | 550 | 55 % |
| Peu commune | 250 | 25 % |
| Rare | 120 | 12 % |
| Épique | 50 | 5 % |
| Légendaire | 25 | 2,5 % |
| Mythique | 5 | 0,5 % |

Ces poids sont vérifiés par un test unitaire (`packages/game-domain/src/booster-draw.test.ts`) qui tire 5000 boosters avec une graine fixe et vérifie que la distribution observée reste dans une fourchette raisonnable autour de la distribution théorique.

## Boosters seedés

| Booster | Catégorie | Cartes | Prix (CR) | Pool |
|---|---|---|---|---|
| Booster Découverte | Discovery | 3 | 80 | Tout le catalogue publié |
| Booster Classique | Classic | 5 | 120 | Tout le catalogue publié |
| Booster Gares & Lieux | Themed | 5 | 150 | Série "Gares & Lieux" uniquement |
| Booster Vie de Quai | Themed | 5 | 150 | Série "Vie de Quai" uniquement |

Chaque booster référence un `BoosterPool` **versionné** (`rulesVersion`). Republier de nouveaux poids via `POST /admin/boosters/:id/pool` crée une nouvelle version et désactive l'ancienne — chaque `BoosterOpening` passé reste lié à la version exacte qui l'a produit, donc l'historique reste auditable même après un rééquilibrage.

## Catalogue initial

53 cartes fictives, réparties en 5 séries qui couvrent les 5 catégories demandées :

1. **Locomotives & Matériel** (Trains et matériel roulant) — 12 cartes
2. **Gares & Lieux** (Gares et lieux) — 11 cartes
3. **Métiers du Rail** (Métiers) — 11 cartes
4. **Vie de Quai** (Vie ferroviaire et humour) — 11 cartes
5. **Éditions Spéciales** — 8 cartes

Tous les noms, personnages et anecdotes sont originaux et fictifs — aucune référence à un logo, une livrée ou un employé réel. Les illustrations sont des placeholders SVG générés (dégradé + motif ferroviaire abstrait par rareté), en attendant de vraies illustrations commandées.

## Monnaie virtuelle — Crédits Rail (CR)

- Montants toujours entiers, jamais de flottant.
- **Sources** : bonus de bienvenue (500 CR, une fois, à l'inscription), récompense quotidienne (20 CR de base + 5 CR par jour de série consécutive, plafonné à 7 jours = 50 CR/jour max), missions, succès, vente sur le marché.
- **Dépenses** : ouverture de boosters, commission du marché (prélevée sur le vendeur, pas ajoutée à la charge de l'acheteur).
- **Puits de monnaie** : la commission du marché (5 % par défaut) n'est **recréditée à personne** — c'est le mécanisme qui empêche l'inflation infinie des CR via des allers-retours d'échange entre comptes contrôlés par la même personne. Documenté explicitement dans `MarketService.buy`.
- Aucun paiement réel, aucune conversion en argent réel, aucune crypto-monnaie — nulle part dans le code.

## Missions & succès (seedés)

Missions journalières (réinitialisées chaque jour, clé de période = date UTC) : connexion, ouverture d'un booster, obtention de 3 nouvelles cartes uniques.

Succès permanents : ouvrir 10 boosters, posséder 50 cartes uniques, compléter 5 échanges, vendre 10 cartes sur le marché.

Les missions et succès **suivent la progression automatiquement** (appelée depuis les transactions Prisma des actions concernées) mais la récompense doit être **réclamée explicitement** (`POST /missions/:id/claim`) — ce choix de design évite un crédit "surprise" invisible et donne un moment de gratification dans l'interface.

## Statistiques de combat

Le champ `CardDefinition.combatStats` (JSON libre) et le flag `combatStatsEnabled` existent dans le modèle de données, comme demandé, mais **aucune fonctionnalité de combat, matchmaking ou tournoi n'est implémentée** dans ce MVP — c'est une extension future volontairement hors scope (voir la mission produit : "les combats reportés après le MVP").

## Paramètres configurables (résumé)

Voir `packages/game-domain/src/constants.ts` (`GAME_CONSTANTS`) pour les valeurs par défaut, et `.env.example` pour ce qui est piloté par variable d'environnement (`MARKET_FEE_BPS`, `INVITE_ONLY_MODE`, `TRADE_CR_ENABLED`).
