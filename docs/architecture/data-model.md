# Modèle de données

Schéma complet : [`prisma/schema.prisma`](../../prisma/schema.prisma). Ce document explique les décisions de modélisation, pas chaque champ (le schéma est commenté et lisible directement).

## Décisions structurantes

### Définition vs exemplaire
`CardDefinition` (la carte "Type 13 — La Tractrice Inlassable", ses textes, son illustration, sa rareté) est **totalement séparée** de `CardInstance` (l'exemplaire UUID que possède un joueur précis, avec son état et son historique). Une carte peut avoir zéro, un ou des milliers d'exemplaires en circulation ; supprimer/archiver une définition n'affecte jamais les exemplaires déjà possédés.

### États explicites plutôt que des booléens épars
`CardInstance.state` est une énumération (`AVAILABLE`, `RESERVED_TRADE`, `RESERVED_MARKET`, `ARCHIVED`) plutôt que des colonnes `isListed`/`isInTrade` séparées. Un exemplaire ne peut être engagé que dans **un seul** processus de transfert à la fois — la réservation lors de la création d'une annonce ou d'une proposition d'échange, combinée aux mises à jour conditionnelles (`WHERE state = 'AVAILABLE'`) dans les services, est ce qui garantit qu'une carte ne peut jamais être vendue deux fois ou échangée en double.

### Boosters versionnés
`BoosterDefinition` → `BoosterPool` (versionné par `rulesVersion`) → `BoosterPoolEntry` (poids par rareté, avec restriction optionnelle à une série ou une carte précise). Chaque `BoosterOpening` enregistre l'`id` du `BoosterPool` utilisé — **jamais** seulement l'`id` de la définition — de sorte qu'on peut toujours reconstituer exactement les probabilités qui ont produit un tirage passé, même après que l'équipe a republié une nouvelle version des poids. Modifier des poids ne réécrit jamais l'historique.

### Économie en entiers, jamais en flottants
Tous les montants (`Wallet.balance`, `WalletTransaction.amount`, `MarketListing.priceCr`, etc.) sont des `Int` Postgres. Aucune opération économique ne manipule de nombre à virgule flottante. La commission du marché est calculée en points de base (`feeBps`, ex. 500 = 5 %) puis arrondie à l'entier inférieur (`Math.floor`).

### Journal, jamais de mutation directe de solde
`WalletTransaction` est un journal **append-only** : `WalletService.credit`/`debit` sont les deux seuls points d'entrée qui touchent `Wallet.balance`, et chaque appel crée une ligne de journal avec le solde résultant (`balanceAfter`). Une correction ne réécrit jamais une ligne existante — elle s'enregistre comme une opération compensatoire supplémentaire (`ADMIN_ADJUSTMENT` / `COMPENSATION`).

### Idempotence par contrainte unique
`WalletTransaction.idempotencyKey` et `BoosterOpening.idempotencyKey` portent une contrainte `@unique`. Rejouer la même clé (même utilisateur, même intention) renvoie le résultat déjà produit au lieu d'en créer un second — c'est ce mécanisme, pas une vérification applicative fragile, qui empêche un double achat de booster en cas de retry réseau.

### Historique économique jamais supprimé en cascade
Les relations qui touchent `WalletTransaction`, `MarketTransaction` ou `AuditLog` n'ont **pas** de `onDelete: Cascade` — l'historique financier doit survivre même si l'entité qui l'a déclenché est un jour retirée.

### UUID partout pour les entités métier
Toutes les clés primaires utilisent `@default(uuid())` plutôt que des entiers auto-incrémentés, pour éviter de révéler un volume d'activité (nombre total de comptes, de cartes émises, etc.) via des identifiants séquentiels exposés dans l'API.

## Entités principales

Identité : `User`, `UserProfile`, `Session` (refresh tokens), `PasswordResetToken`, `Invitation`
Catalogue : `Rarity`, `CardSeries`, `CardDefinition`
Collection : `CardInstance`
Boosters : `BoosterDefinition`, `BoosterPool`, `BoosterPoolEntry`, `BoosterOpening`, `BoosterPull`
Économie : `Wallet`, `WalletTransaction`
Échanges : `Trade`, `TradeItem`
Marché : `MarketListing`, `MarketTransaction`
Progression : `Mission`, `UserMission`, `Achievement`, `UserAchievement`, `DailyRewardClaim`
Live Ops : `Event`
Social/modération : `Notification`, `Report`, `AuditLog`

## Contrainte SQL native

`Wallet.balance` porte une contrainte `CHECK (balance >= 0)` ajoutée par migration SQL brute (Prisma n'a pas de support déclaratif des contraintes `CHECK` dans son DSL de schéma). C'est une défense en profondeur : le code applicatif (`WalletService.debit`, avec sa mise à jour conditionnelle `WHERE balance >= amount`) est la garde principale contre un solde négatif ; la contrainte SQL protège contre un bug futur ou un accès direct à la base qui contournerait le code applicatif.
