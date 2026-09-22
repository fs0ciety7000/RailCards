/**
 * Idempotent development/demo seed.
 * Run with: pnpm db:seed
 *
 * Safe to re-run: every write is an upsert keyed on a stable natural key
 * (slug/code/email/username), so re-seeding never duplicates data.
 */
import { PrismaClient, type CardCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RARITY_DEFINITIONS, GAME_CONSTANTS } from "@railcards/game-domain";
import { SEED_SERIES, TOTAL_SEED_CARD_COUNT } from "./seed-data/cards";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "RailCards!Demo2026";
const ADMIN_PASSWORD = "RailCards!Admin2026";

async function seedRarities() {
  const byCode: Record<string, string> = {};
  for (const r of RARITY_DEFINITIONS) {
    const row = await prisma.rarity.upsert({
      where: { code: r.code },
      update: { label: r.label, order: r.order, colorHex: r.colorHex },
      create: { code: r.code, label: r.label, order: r.order, colorHex: r.colorHex },
    });
    byCode[r.code] = row.id;
  }
  return byCode;
}

function placeholderImageUrl(rarityCode: string) {
  return `/card-placeholders/${rarityCode.toLowerCase()}.svg`;
}

async function seedCatalog(rarityIdByCode: Record<string, string>) {
  const cardIdsBySeriesAndRarity: Record<string, Record<string, string[]>> = {};

  for (const series of SEED_SERIES) {
    const seriesRow = await prisma.cardSeries.upsert({
      where: { slug: series.slug },
      update: {
        name: series.name,
        description: series.description,
        category: series.category as CardCategory,
        isActive: true,
      },
      create: {
        slug: series.slug,
        name: series.name,
        description: series.description,
        category: series.category as CardCategory,
        isActive: true,
      },
    });

    cardIdsBySeriesAndRarity[seriesRow.id] = {};

    for (const card of series.cards) {
      const rarityId = rarityIdByCode[card.rarity];
      if (!rarityId) throw new Error(`Unknown rarity code ${card.rarity}`);

      const cardRow = await prisma.cardDefinition.upsert({
        where: { slug: card.slug },
        update: {
          name: card.name,
          description: card.description,
          flavorText: card.flavorText,
          category: series.category as CardCategory,
          rarityId,
          imageUrl: card.imageUrl ?? placeholderImageUrl(card.rarity),
          status: card.status ?? "PUBLISHED",
          combatStatsEnabled: card.combatStatsEnabled ?? false,
          combatStats: card.combatStats ?? undefined,
        },
        create: {
          slug: card.slug,
          seriesId: seriesRow.id,
          name: card.name,
          description: card.description,
          flavorText: card.flavorText,
          category: series.category as CardCategory,
          rarityId,
          imageUrl: card.imageUrl ?? placeholderImageUrl(card.rarity),
          status: card.status ?? "PUBLISHED",
          combatStatsEnabled: card.combatStatsEnabled ?? false,
          combatStats: card.combatStats ?? undefined,
        },
      });

      cardIdsBySeriesAndRarity[seriesRow.id]![rarityId] ??= [];
      cardIdsBySeriesAndRarity[seriesRow.id]![rarityId]!.push(cardRow.id);
    }
  }

  console.log(`Seeded ${TOTAL_SEED_CARD_COUNT} card definitions across ${SEED_SERIES.length} series.`);
  return cardIdsBySeriesAndRarity;
}

async function seedBoosters(rarityIdByCode: Record<string, string>, seriesIdBySlug: Record<string, string>) {
  const boosterDefs = [
    {
      slug: GAME_CONSTANTS.FREE_BOOSTER_SLUG,
      name: "Booster Gratuit",
      description: `2 cartes offertes, à réclamer toutes les ${GAME_CONSTANTS.FREE_BOOSTER_INTERVAL_HOURS} heures.`,
      category: "DISCOVERY" as const,
      priceCr: 0,
      cardCount: 2,
      seriesSlug: null as string | null,
    },
    {
      slug: "booster-decouverte",
      name: "Booster Découverte",
      description: "L'entrée idéale dans RailCards : 3 cartes toutes séries confondues, à prix doux.",
      category: "DISCOVERY" as const,
      priceCr: 80,
      cardCount: 3,
      seriesSlug: null as string | null,
    },
    {
      slug: "booster-classique",
      name: "Booster Classique",
      description: "Le format standard : 5 cartes piochées dans tout le catalogue publié.",
      category: "CLASSIC" as const,
      priceCr: 120,
      cardCount: 5,
      seriesSlug: null as string | null,
    },
    {
      slug: "booster-gares-et-lieux",
      name: "Booster Thématique — Gares & Lieux",
      description: "5 cartes exclusivement issues de la série Gares & Lieux.",
      category: "THEMED" as const,
      priceCr: 150,
      cardCount: 5,
      seriesSlug: "gares-et-lieux",
    },
    {
      slug: "booster-vie-de-quai",
      name: "Booster Thématique — Vie de Quai",
      description: "5 cartes exclusivement issues de la série humoristique Vie de Quai.",
      category: "THEMED" as const,
      priceCr: 150,
      cardCount: 5,
      seriesSlug: "vie-de-quai",
    },
  ];

  for (const def of boosterDefs) {
    const boosterRow = await prisma.boosterDefinition.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        priceCr: def.priceCr,
        cardCount: def.cardCount,
        imageUrl: `/booster-placeholders/${def.category.toLowerCase()}.svg`,
        isActive: true,
      },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        category: def.category,
        priceCr: def.priceCr,
        cardCount: def.cardCount,
        imageUrl: `/booster-placeholders/${def.category.toLowerCase()}.svg`,
        isActive: true,
      },
    });

    const pool = await prisma.boosterPool.upsert({
      where: { boosterDefinitionId_rulesVersion: { boosterDefinitionId: boosterRow.id, rulesVersion: 1 } },
      update: { isActive: true },
      create: { boosterDefinitionId: boosterRow.id, rulesVersion: 1, isActive: true },
    });

    // Reset entries for this pool version so re-seeding stays idempotent
    // even if rarity weights changed.
    await prisma.boosterPoolEntry.deleteMany({ where: { boosterPoolId: pool.id } });

    const seriesId = def.seriesSlug ? seriesIdBySlug[def.seriesSlug] : null;
    await prisma.boosterPoolEntry.createMany({
      data: RARITY_DEFINITIONS.map((r) => ({
        boosterPoolId: pool.id,
        rarityId: rarityIdByCode[r.code]!,
        weight: r.defaultWeight,
        seriesId: seriesId ?? null,
      })),
    });
  }

  console.log(`Seeded ${boosterDefs.length} booster definitions with versioned pools.`);
}

async function seedMissionsAndAchievements() {
  const missions = [
    { code: "daily-login", title: "Pointer présent", description: "Connecte-toi aujourd'hui.", goalType: "LOGIN" as const, goalCount: 1, rewardCr: 10, rewardXp: 5, resetPeriod: "DAILY" as const },
    { code: "daily-open-booster", title: "Ouvrir un booster", description: "Ouvre au moins un booster aujourd'hui.", goalType: "OPEN_BOOSTER" as const, goalCount: 1, rewardCr: 20, rewardXp: 10, resetPeriod: "DAILY" as const },
    { code: "daily-collect-cards", title: "Enrichir sa collection", description: "Obtiens 3 nouvelles cartes uniques aujourd'hui.", goalType: "COLLECT_UNIQUE_CARDS" as const, goalCount: 3, rewardCr: 15, rewardXp: 10, resetPeriod: "DAILY" as const },
  ];

  for (const m of missions) {
    await prisma.mission.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }

  const achievements = [
    { code: "open-10-boosters", title: "Habitué des boosters", description: "Ouvre 10 boosters au total.", goalType: "OPEN_BOOSTER" as const, goalCount: 10, rewardCr: 100, rewardXp: 50 },
    { code: "collect-50-unique", title: "Collectionneur confirmé", description: "Possède 50 cartes uniques différentes.", goalType: "COLLECT_UNIQUE_CARDS" as const, goalCount: 50, rewardCr: 250, rewardXp: 150 },
    { code: "complete-5-trades", title: "Négociateur", description: "Complète 5 échanges avec d'autres joueurs.", goalType: "COMPLETE_TRADE" as const, goalCount: 5, rewardCr: 100, rewardXp: 75 },
    { code: "sell-10-market", title: "Vendeur aguerri", description: "Vends 10 cartes sur le marché.", goalType: "SELL_ON_MARKET" as const, goalCount: 10, rewardCr: 150, rewardXp: 75 },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: a,
      create: a,
    });
  }

  console.log(`Seeded ${missions.length} missions and ${achievements.length} achievements.`);
}

async function seedUsers() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@railcards.local" },
    update: {},
    create: {
      email: "admin@railcards.local",
      username: "admin_railcards",
      displayName: "Administration RailCards (DEMO)",
      passwordHash: adminHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      profile: { create: {} },
      wallet: { create: { balance: 0 } },
    },
  });

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const demoUsersData = [
    { email: "jules@railcards.local", username: "cheminot_jules", displayName: "Jules (compte démo)" },
    { email: "amelie@railcards.local", username: "amelie_du_rail", displayName: "Amélie (compte démo)" },
    { email: "theo@railcards.local", username: "guichet_theo", displayName: "Théo (compte démo)" },
  ];

  for (const u of demoUsersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        passwordHash: demoHash,
        role: "USER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        profile: { create: {} },
        wallet: { create: { balance: GAME_CONSTANTS.WELCOME_BONUS_CR } },
      },
    });
  }

  console.log("Seeded 1 admin + 3 demo player accounts (DEMO DATA — do not use in production).");
  console.log(`  admin: admin@railcards.local / ${ADMIN_PASSWORD}`);
  console.log(`  demo players: *.local / ${DEMO_PASSWORD}`);
  return admin;
}

async function main() {
  const rarityIdByCode = await seedRarities();
  await seedCatalog(rarityIdByCode);

  const seriesRows = await prisma.cardSeries.findMany({ select: { id: true, slug: true } });
  const seriesIdBySlug = Object.fromEntries(seriesRows.map((s) => [s.slug, s.id]));

  await seedBoosters(rarityIdByCode, seriesIdBySlug);
  await seedMissionsAndAchievements();
  await seedUsers();

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
