# Sauvegarde et restauration

## Sauvegarde

### En local / self-hosted

```bash
pg_dump "postgresql://railcards:railcards_dev_password@localhost:5432/railcards" \
  --format=custom --file=railcards-backup-$(date +%Y%m%d-%H%M%S).dump
```

Planifiez cette commande via cron (ou l'équivalent CI/CD) à la fréquence adaptée à votre tolérance de perte de données (ex. toutes les 6 heures en bêta privée).

### Avec un hébergeur managé (Neon, Supabase)

Ces plateformes fournissent des sauvegardes automatiques et un **point-in-time recovery** sur leurs paliers payants ; le palier gratuit a généralement une fenêtre de rétention plus courte (vérifiez la documentation du fournisseur choisi). Pour une bêta privée à faible volume, un `pg_dump` programmé en complément reste une bonne pratique de défense en profondeur.

## Restauration

```bash
pg_restore --clean --if-exists \
  --dbname="postgresql://railcards:railcards_dev_password@localhost:5432/railcards" \
  railcards-backup-20260101-120000.dump
```

Après restauration, vérifiez la cohérence :

```bash
pnpm --filter @railcards/database prisma:migrate status
```

Si la base restaurée est en retard sur des migrations plus récentes, appliquez-les :

```bash
pnpm db:migrate:deploy
```

## Ce qui n'est PAS couvert par un dump PostgreSQL

- Les objets uploadés sur un stockage S3-compatible (si branché) — sauvegarder ce bucket séparément selon les outils du fournisseur.
- L'état Redis (BullMQ) — il ne contient que des files de tâches différées et des sessions de présence, aucune donnée qui ne puisse être reconstruite ; **ne pas** le considérer comme une source de vérité à sauvegarder.

## Procédure de restauration testée

À ce stade du projet, la commande `pg_restore` ci-dessus a été vérifiée dans son principe (restauration standard PostgreSQL) mais **pas exécutée en conditions réelles** sur un dump RailCards complet dans le cadre de ce MVP — à faire avant toute mise en production, en même temps qu'un exercice de restauration à blanc (« game day »).
