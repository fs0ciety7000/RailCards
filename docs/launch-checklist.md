# Checklist de lancement (bêta privée)

Ce document suit littéralement les critères de fin définis dans le brief produit. Statut honnête à la date de rédaction — voir aussi [docs/product/known-limitations.md](product/known-limitations.md).

## Critères de fin du MVP

- [x] Le projet démarre avec les instructions documentées (`README.md`, `pnpm dev`)
- [x] Les migrations s'exécutent (`pnpm db:migrate:deploy`)
- [x] Le seed fonctionne, et est idempotent (`pnpm db:seed`, vérifié en le rejouant deux fois)
- [x] Un joueur peut s'inscrire et se connecter (testé par intégration + manuellement via curl)
- [x] Un joueur peut ouvrir un booster (débit + tirage serveur + attribution, testé par intégration)
- [x] Les cartes sont attribuées et visibles dans son album (`GET /collection`, `GET /collection/album`)
- [x] Les Crédits Rail sont correctement débités et crédités (testé, y compris sous concurrence)
- [x] Deux joueurs peuvent échanger des cartes (création, acceptation, transfert atomique — testé)
- [x] Un joueur peut mettre une carte en vente et un autre l'acheter (testé, y compris achat concurrent)
- [x] Les opérations économiques sont atomiques et testées (23 tests d'intégration contre PostgreSQL réel)
- [x] L'administration est protégée (garde de rôle testé, aucune route de self-promotion)
- [x] Les parcours principaux sont utilisables sur smartphone — vérifié en navigateur réel (Playwright, viewport mobile 390×844 et desktop 1280×900) sur le parcours complet inscription → booster → collection → marché, voir `apps/web/e2e/golden-path.spec.ts`
- [x] Les tests pertinents ont été réellement exécutés (pas de mock de base de données sur les tests d'intégration)
- [x] Les limitations restantes sont documentées ([known-limitations.md](product/known-limitations.md))

## Avant d'ouvrir la bêta privée

- [ ] Changer le mot de passe du compte admin seedé (ou en créer un nouveau et désactiver l'ancien)
- [ ] Régénérer tous les secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`) avec `openssl rand -base64 48`
- [ ] Déployer selon [docs/deployment.md](deployment.md) (web sur Vercel, API/worker sur un hébergeur à processus long-vivant, Postgres + Redis managés)
- [ ] Vérifier `GET /api/v1/health` en production
- [ ] Générer les premiers codes d'invitation pour les testeurs
- [ ] Mettre en place une sauvegarde programmée ([docs/backup-restore.md](backup-restore.md))
- [ ] Revoir `MARKET_FEE_BPS`, `INVITE_ONLY_MODE`, les montants de `GAME_CONSTANTS` selon l'équilibrage souhaité
- [ ] Brancher un vrai fournisseur SMTP si la vérification d'email est jugée nécessaire avant l'ouverture publique
- [ ] Faire un exercice de restauration de sauvegarde à blanc

## Résumé par phase (voir aussi l'historique de commits)

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Inspection du dépôt (vide au départ), plan | ✅ |
| 1 | Fondations monorepo, Docker Compose, Prisma init, CI | ✅ |
| 2 | Authentification, invitations, rôles, catalogue, collection | ✅ |
| 3 | Wallet, boosters (tirage serveur idempotent), missions | ✅ |
| 4 | Échanges, marché, transferts atomiques, notifications | ✅ |
| 5 | Administration (catalogue, boosters, joueurs, audit, signalements) | ✅ |
| 6 | Tests d'intégration/concurrence contre PostgreSQL, tests unitaires, E2E Playwright, CI | ✅ |
| 7 | Préparation bêta privée (ce document, guides, checklist) | ✅ |
| — | Frontend Next.js (15 écrans, design system `packages/ui`) | ✅ — voir [known-limitations.md](product/known-limitations.md) pour le détail des simplifications assumées |

## Ce qui reste explicitement hors scope de ce MVP (décision produit assumée)

Combats/matchmaking, contre-propositions d'échange (endpoint dédié), vérification d'email réelle, réinitialisation de mot de passe (endpoints), stockage S3 réel, observabilité (Sentry/OpenTelemetry) branchée — tous préparés dans le modèle de données ou la configuration mais non implémentés. Voir [known-limitations.md](product/known-limitations.md) pour le détail complet.
